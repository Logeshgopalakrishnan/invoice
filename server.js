const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

// Enable CORS
app.use(cors());

// Multer setup for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// Route to handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  console.log('File uploaded:', req.file.originalname);

  // Parse CSV file and remove empty rows
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      if (Object.values(data).some(val => val.trim() !== '')) {
        results.push(data);
      }
    })
    .on('end', () => {
      // Transform data into desired JSON format
      const jsonData = { data: [] };
      results.forEach(row => {
        // Check if invoice number already exists in JSON data
        const existingInvoice = jsonData.data.find(invoice => invoice["invoice_number"] === row['Invoice Number']);
        if (existingInvoice) {
          // Invoice already exists, append line item
          existingInvoice["line_items"].push({
            "quantity": row['Quantity'],
            "sku": row["Sku"],
            "description": row['Item Description']
          });
        } else {
          // Invoice doesn't exist, create new invoice
          const invoice = {
            "invoice_number": row['Invoice Number'],
            "date": row['Invoice Date'],
            "line_items": [
              {
                "quantity": row['Quantity'],
                "sku": row["Sku"],
                "description": row['Item Description']
              }
            ]
          };
          jsonData.data.push(invoice);
          
        }
      });
      console.log(jsonData)

      // Write JSON data to a new file
      const outputFile = path.join(__dirname, 'uploads', `${req.file.originalname}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(jsonData, null, 2));

      console.log('JSON file saved:', outputFile);

      // Delete the uploaded CSV file after processing
      fs.unlinkSync(req.file.path);

      res.status(200).json({ message: 'File uploaded and processed successfully' });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send(`Internal Server Error: ${err.message}`);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
