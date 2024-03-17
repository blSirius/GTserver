const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config()

const port = process.env.ENV_SERVER_PORT;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

const secretKey = 'PeemSecert';

app.get('/getFaceDetectedHome', async (req, res) => {
  // Format today's date as D/M/YYYY (without leading zeros for day and month)
  const today = new Date();
  const formattedDate = [
    today.getDate() - 1, // Adjusting day to yesterday
    today.getMonth() + 1, // Adjusting month since January is 0
    today.getFullYear(),
  ].map(component => component.toString().padStart(2, '0')).join('/');
  console.log(formattedDate)
  try {
    const query = "SELECT * FROM face_detection WHERE name != 'unknown' AND date = ? ORDER BY id DESC";
    const result = await mysqlDB.query(query, [formattedDate]);
    console.log(result)
    res.json(result);
  } catch (err) {
    console.error('Error fetching face detections:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/register', async (req, res) => {
  const { username, password, status } = req.body;

  try {
    // Password hashing disabled for simplicity. It should be enabled in production.
    const result = await pool.query(
      'INSERT INTO authentication (username, password, status) VALUES ($1, $2, $3) RETURNING *',
      [username, password, status]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).send('Internal Server Error');
  }
});

const mysqlDB = require('./database/mysql');

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const query = 'SELECT * FROM authentication WHERE username = ? AND password = ?';
    const result = await mysqlDB.query(query, [username, password]);

    if (result.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({ username: username }, secretKey, { expiresIn: '1h' });

    res.json({ message: 'Login successful', token: token });
  } catch (error) {
    console.error('Error during login:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/decodeToken', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token not provided' });
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.json({ message: 'decoded success', decoded: decoded });
  });
});

app.post('/createEmployee/:name', async (req, res) => {
  const name = req.params.name;

  console.log(name)
  try {
    const query = 'INSERT INTO employee ( employee_name) VALUES ( ?)'
    const result = await mysqlDB.query(query, [name]);

    console.log(result);

    res.status(201).json(result);
  }
  catch (err) {
    console.error('Error during createEmployee:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/getEmployee', async (req, res) => {
  try {
    // Assuming mysqlDB is a pool or connection created with a MySQL client library like `mysql` or `mysql2`
    mysqlDB.query('SELECT * FROM employee', (error, results, fields) => {
      if (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
      }
      // console.log(results);
      res.status(200).json(results); // Changed status code to 200 for successful retrieval
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/getEmployeeDetail/:id', async (req, res) => {
  const empID = parseInt(req.params.id, 10); // Parse empID to an integer
  try {
    const result = await pool.query('SELECT * FROM employee WHERE employee_id = $1', [empID]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/getEmpDetect/:name', async (req, res) => {
  // Split the 'name' parameter into an array of names assuming they are separated by a comma
  const names = req.params.name.split(',');
  console.log(names)
  try {
    let results = [];

    for (const name of names) {
      // Trim the name to remove any whitespace
      const trimmedName = name.trim();

      let query;
      let queryParams;

      // Check if 'name' contains '.png' to decide on the query
      if (trimmedName.includes('.png') || trimmedName.includes('.jpg')) {
        query = 'SELECT * FROM face_detection WHERE face_detection.path = ?';
        queryParams = [trimmedName];
      } else {
        query = 'SELECT * FROM face_detection WHERE face_detection.name LIKE ? OR face_detection.name = ?';
        queryParams = [`%${trimmedName}%`, trimmedName];
      }

      // Run the query and collect the results
      // console.log(query)
      const result = await mysqlDB.query(query, queryParams);
      if (result.length) {
        results = results.concat(result); // Concatenate the result arrays
      }
    }

    // console.log(results);
    res.json(results);
  } catch (err) {
    console.error('Error fetching face detections:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/getAllhistory', async (req, res) => {
  try {
    mysqlDB.query('SELECT * FROM face_detection WHERE name != "unknown"', (error, results, fields) => {
      if (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
      }
      // console.log(results);
      res.status(200).json(results); // Changed status code to 200 for successful retrieval
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).send('Internal Server Error');
  }
})



app.get('/getAllhistoryByDate', async (req, res) => {

  const today = new Date().toISOString().slice(0, 10); // No need to convert to DD/MM/YYYY here, SQL will handle it.
  
  function formatDateToDDMMYYYY(dateString) {
    if (typeof dateString !== 'string' || !dateString) {
      return null;
    }
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
  // console.log('Today is : '+formatDateToDDMMYYYY(today))

  let { dateStart, dateStop } = req.query;
  dateStart = typeof dateStart === 'string' ? formatDateToDDMMYYYY(dateStart) : null;
  dateStop = typeof dateStop === 'string' ? formatDateToDDMMYYYY(dateStop) : formatDateToDDMMYYYY(today);
  
  let queryParams = [];
  let query = 'SELECT * FROM face_detection WHERE name != "unknown"';
  
  if (dateStart) {
    query += ' AND STR_TO_DATE(date, "%d/%m/%Y") BETWEEN STR_TO_DATE(?, "%d/%m/%Y")';
    queryParams.push(dateStart);
  }
  
  // Check for the presence of dateStop in the request, otherwise use today's date
  if (!dateStop || dateStop === 'undefined/undefined/null') {
    dateStop = formatDateToDDMMYYYY(today);
  }
  
  query += ' AND STR_TO_DATE(?, "%d/%m/%Y")';
  queryParams.push(dateStop);

  // Debug logs
  console.log('Query:', query);
  console.log('Query Parameters:', queryParams);
  
  try {
    const [results] = await mysqlDB.query(query, queryParams);
    console.log('Query results:', results);
    res.json(results);
  } catch (error) {
    console.error('Error during database query:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.delete('/deleteEmployee/:id', async (req, res) => {
  const empID = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('DELETE FROM employee WHERE id = $1', [empID]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      res.status(204).send(); // 204 No Content for successful deletion
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.use('/labels', express.static(path.join(process.cwd(), 'labels')));

app.get('/api/labels', (req, res) => {
  const labelsDir = path.join(process.cwd(), 'labels');
  fs.readdir(labelsDir, { withFileTypes: true }, (err, files) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
      return;
    }
    const labels = files
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        const labelPath = path.join(labelsDir, dirent.name);
        const images = fs.readdirSync(labelPath).filter(file => file.endsWith('.png') || file.endsWith('.jpg'));
        return { label: dirent.name, imageCount: images.length };
      });
    res.json(labels);
    // console.log('test')
    // console.log(labels)
  });
});

app.use('/api/detectedSingleFace', express.static(path.join(process.cwd(), 'unknownImgStore')));

app.get('/api/detectedSingleFace/files', async (req, res) => {
  const directoryPath = path.join(process.cwd(), 'unknownImgStore');
  try {
    const files = await fs.promises.readdir('unknownImgStore');
    res.json(files);
  } catch (error) {
    console.error("Error reading directory", error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/detectedSingleFace', async (req, res) => {
  try {
    // const directoryPath = path.join(process.cwd(), 'unknownImgStore');
    const files = await fs.readdir('unknownImgStore');
    // const files = await fs.readdir(directoryPath);
    console.log(files)
    res.json(files);
  } catch (error) {
    console.error("Error accessing the directory", error);
    res.status(500).send('Internal Server Error');
  }
});

app.use('/labeled_images', express.static('knownImgStore'));

app.use('/getImageFolder', express.static('labels'));
app.use('/getDetectedSingleFaceKnown', express.static('knownImgStore'));

const getFilesInDirectory = async (dirPath) => {
  try {
    const files = await fs.promises.readdir(dirPath);
    return files.filter(file => path.extname(file).toLowerCase() === '.png');
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }
};

app.get('/getFilePic/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const folderPath = path.join(process.cwd(), 'labels', name);

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const files = await getFilesInDirectory(folderPath);
    res.json(files);
  } catch (error) {
    console.error('Error getting picture files:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/getLabelFolder', (req, res) => {
  try {
    const folders = fs.readdirSync('labels', { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    res.json({ folders });
  } catch (error) {
    console.error('Error getting folder names:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/deleteImage/:name/:path', (req, res) => {
  const { name, path: fileName } = req.params;
  const imagePath = path.join(process.cwd(), 'labels', name, fileName);
  console.log('path is: ')
  console.log(imagePath)
  // Check if the file exists
  if (fs.existsSync(imagePath)) {
    // Delete the file
    fs.unlink(imagePath, (err) => {
      if (err) {
        console.error('Error deleting the file:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ message: 'File deleted successfully' });
    });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/updateImageFolder', upload.single('croppedImage'), (req, res) => {
  try {
    const folderName = req.body.folderName;
    const buffer = req.file.buffer;
    const folderPath = `labels/${folderName}`;

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Generate a date-time string format YYYYMMDD-HHmmss
    const dateTimeString = new Date().toISOString()
      .replace(/T/, '-')      // Replace T with a dash
      .replace(/\..+/, '')    // Delete the dot and everything after
      .replace(/:/g, '');     // Remove colons

    const newImageName = `${folderName}-${dateTimeString}.png`;
    const imagePath = path.join(folderPath, newImageName);

    // Save buffer to file system
    fs.writeFileSync(imagePath, buffer);

    res.json({ message: 'Successfully uploaded', fileName: newImageName });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

//get image from kiosk server

const storager = (folder) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, folder),
  filename: (req, file, cb) => cb(null, file.originalname)
});

const uploader = (folder) => multer({ storage: storager(folder) });

app.post('/knownImageTransfer', uploader('knownImgStore').single('image'), (req, res) => {
  res.send('File uploaded successfully');
});

app.post('/unknownImageTransfer', uploader('unknownImgStore').single('image'), (req, res) => {
  res.send('File uploaded successfully');
});

app.post('/envImageTransfer', uploader('envImgStore').single('image'), (req, res) => {
  res.send('File uploaded successfully');
});