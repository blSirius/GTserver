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
    const query = 'INSERT INTO employee ( employee_name,status) VALUES ( ?,"ON")'
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

    const { name } = req.query;
    // console.log(name)
    const placeholder = name ? `%${name}%` : '%';
    const query = 'SELECT * FROM employee WHERE status = "ON" AND employee_name LIKE ?';

    const results = await mysqlDB.query(query, [placeholder]);

    if (results.length === 0) {
      res.status(404).json({ error: 'No employees found' });
    } else {
      res.json(results);
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});
app.get('/getEmployeeOff', async (req, res) => {
  try {

    const { name } = req.query;
    console.log(name)
    const placeholder = name ? `%${name}%` : '%';
    const query = 'SELECT * FROM employee WHERE status = "OFF" AND employee_name LIKE ?';

    const results = await mysqlDB.query(query, [placeholder]);

    if (results.length === 0) {
      res.status(404).json({ error: 'No employees found' });
    } else {
      res.json(results);
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/getUnknownDetect', async (req, res) => {
  try {
    // Assuming mysqlDB is a pool or connection created with a MySQL client library like `mysql` or `mysql2`
    mysqlDB.query('SELECT * FROM face_detection WHERE name = "unknown"', (error, results, fields) => {
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

app.post('/deletefolder', async (req, res) => {
  const { folderName } = req.body;
  // console.log(folderName)
  if (!folderName) {
      return res.status(400).send('No folder name provided');
  }

  const folderPath = path.join(process.cwd(), 'statusoff', folderName);

  try {
      // Check if the folder exists
      // await fs.access(folderPath);
      // Delete the folder
      fs.rm(folderPath, { recursive:true }, (err) => { 
        if(err){ 
            console.error(err.message); 
            return; 
        } 
        // console.log("File deleted successfully"); 
          
      
    }) 
      res.send(`Folder '${folderName}' deleted successfully.`);
  } catch (error) {
      console.error('Error deleting folder:', error);
      res.status(500).send('Error deleting folder');
  }
});

app.post('/deleteDB', async (req, res) => {
  const { folderName } = req.body;
  if (!folderName) {
      return res.status(400).send('No folder name provided');
  }

  try {
      query = 'DELETE FROM employee WHERE employee_name = ?'
      res = mysqlDB.query(query,[folderName])
      
  } catch (error) {
      console.error('Error deleting DB:', error);
      res.status(500).send('Error deleting DB');
  }
});

app.post('/renameFolder', async (req, res) => {
  const { oldName, newName } = req.body;

  // Define the full paths for the old and new folder names
  const oldPath = path.join(process.cwd(), 'labels', oldName);
  const newPath = path.join(process.cwd(), 'labels', newName);
  fs.rename(oldPath, newPath, (err) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error renaming the folder.');
    } else {
      res.send('Folder renamed successfully.');
    }
  });
});
app.post('/updateEmployeeName', async (req, res) => {
  const { oldName, newName } = req.body;


  try {
    const query = 'UPDATE employee SET employee_name = ? WHERE employee_name = ?';
    const result = await mysqlDB.query(query, [newName, oldName]);

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Employee not found or name unchanged' });
    } else {
      res.json({ message: 'Employee name updated successfully' });
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/updateStatusDB', async (req, res) => {
  const { folderName, status } = req.body;
  // console.log(folderName)
  // console.log(status)
  try {
    const query = 'UPDATE employee SET status = ? WHERE employee_name = ?';
    const result = await mysqlDB.query(query, [status, folderName]);

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Employee not found or name unchanged' });
    } else {
      res.json({ message: 'Employee name updated successfully' });
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/changeStatus', (req, res) => {
  const { folderName, status } = req.body;
  let oldPath;
  let newPath;

  if (status === 'OFF') {
    oldPath = path.join(process.cwd(), 'labels', folderName);
    newPath = path.join(process.cwd(), 'statusoff', folderName);
  } else if (status === 'ON') {
    oldPath = path.join(process.cwd(), 'statusoff', folderName);
    newPath = path.join(process.cwd(), 'labels', folderName);
  } else {
    return res.status(400).send('Invalid status value.');
  }

  fs.rename(oldPath, newPath, (err) => {
    if (err) {
      console.error(err);
      res.status(500).send('An error occurred while moving the folder.');
    } else {
      res.send(`Folder moved to ${status === 'OFF' ? 'statusoff' : 'labels'} successfully.`);
    }
  });
});



app.get('/getEmployeeDetail/:name', async (req, res) => {
  const name = req.params.name;
  // console.log(typeof(name));
  try {
    const query = 'SELECT * FROM employee WHERE employee_name = ?';
    const [rows] = await mysqlDB.query(query, [name]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      // console.log(rows);
      res.json(rows);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});
app.get('/getExpression', async (req, res) => {
  const sql = "SELECT DISTINCT emotion FROM expression";
  try {
    const emotions = await mysqlDB.query(sql);
    res.json(emotions);
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).send('Server error occurred.');
  }
});

app.post('/addGreeting', async (req, res) => {
  const { emotion, greeting } = req.body;
  const sql = "INSERT INTO expression (emotion, greeting) VALUES (?, ?)";
  try {
    await mysqlDB.query(sql, [emotion, greeting]);
    res.send('Greeting added successfully.');
  } catch (error) {
    console.error('Database insert error:', error);
    res.status(500).send('Server error occurred.');
  }
});

app.post('/getGreeting', async (req, res) => {
  const { emotion } = req.body;
  const sql = "SELECT * FROM expression WHERE emotion = ?";
  try {
    const greetings = await mysqlDB.query(sql, [emotion]);
    res.json(greetings);
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).send('Server error occurred.');
  }
});

app.delete('/deleteGreeting', async (req, res) => {
  const { emotion, greeting } = req.body;

  try {
    const checkSql = "SELECT COUNT(*) AS count FROM expression WHERE emotion = ?";
    const [checkResults] = await mysqlDB.query(checkSql, [emotion]);
    const count = Array.isArray(checkResults) ? checkResults[0].count : checkResults.count;

    if (count > 1) {
      const deleteSql = "DELETE FROM expression WHERE emotion = ? AND greeting = ?";
      await mysqlDB.query(deleteSql, [emotion, greeting]);
      res.send('Greeting deleted successfully.');
    } else {
      res.status(400).send('Cannot delete the only greeting for an emotion.');
    }
  } catch (error) {
    console.error('Database delete error:', error);
    res.status(500).send('Server error occurred.');
  }
});
app.get('/getEmpDetect/:name', async (req, res) => {
  // Split the 'name' parameter into an array of names assuming they are separated by a comma
  const names = req.params.name.split(',');
  // console.log(names)
  // console.log(names)
  const today = new Date().toISOString().slice(0, 10); // No need to convert to DD/MM/YYYY here, SQL will handle it.

  function formatDateToDDMMYYYY(dateString) {
    if (typeof dateString !== 'string' || !dateString) {
      return null;
    }
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
  let { dateStart, dateStop } = req.query;
  dateStart = typeof dateStart === 'string' ? formatDateToDDMMYYYY(dateStart) : null;
  dateStop = formatDateToDDMMYYYY(dateStop)
  console.log(names)



  try {
    let results = [];

    if (names) {

      for (const name of names) {
        const trimmedName = name.split(' ');
        const realname = trimmedName[0]
        let query = 'SELECT * FROM face_detection ';
        let queryParams = [];
        if (realname.includes('.png') || realname.includes('.jpg')) {
          query += 'WHERE face_detection.path = ?';
          queryParams.push(realname);
        } else {
          query += 'WHERE face_detection.name LIKE ?';
          queryParams.push(`%${realname}%`)
        }

        if (dateStart) {

          query += ' AND STR_TO_DATE(date, "%d/%m/%Y") BETWEEN STR_TO_DATE(?, "%d/%m/%Y")';

          queryParams.push(dateStart);
          if (!dateStop || dateStop === 'undefined/undefined/null') {
            // console.log('test this1')
            query += ' AND STR_TO_DATE(?, "%d/%m/%Y")';
            dateStop = formatDateToDDMMYYYY(today);
            queryParams.push(dateStop);
          } else if (dateStop) {
            // console.log('test this2 ' + dateStop)
            query += ' AND STR_TO_DATE(?, "%d/%m/%Y")';
            queryParams.push(dateStop);
          }
        } else {
          query += ' OR face_detection.name = ?';
          queryParams.push(realname)
        }

        const result = await mysqlDB.query(query, queryParams);

        console.log(result)
        // res.json(results);
        if (result.length) {
          results = results.concat(result); 
        }
       
      }
      res.json(results);
    }
    // console.log(results)
    // console.log(results);
    
  } catch (err) {
    console.error('Error fetching face detections:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/getAllhistory', async (req, res) => {
  try {
    mysqlDB.query('SELECT * FROM face_detection JOIN employee ON face_detection.name = employee.employee_name WHERE name != "unknown" AND employee.status = "ON"', (error, results, fields) => {
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
app.get('/getAllhistoryONOFF', async (req, res) => {
  const today = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).slice(0, 10);
  console.log(today)
  let {date} = req.query

  let dateUSE = typeof date === 'string' ? formatDateToDDMMYYYY(date) : null;
  // console.log(formatDateToDDMMYYYY(date))
  console.log('why?'+dateUSE)
  function formatDateToDDMMYYYY(dateString) {
    if (typeof dateString !== 'string' || !dateString) {
      return null;
    }
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
  try {
    if(!date){
      query = 'SELECT * FROM face_detection JOIN employee ON face_detection.name = employee.employee_name WHERE date = ? ORDER BY face_detection.id DESC'
      // let queryParams = formatDateToDDMMYYYY(today)
      // console.log('test1')
      // console.log(queryParams)
      const results = await mysqlDB.query(query,today);
      res.json(results);
    }else{
      query = 'SELECT * FROM face_detection JOIN employee ON face_detection.name = employee.employee_name WHERE date = ? ORDER BY face_detection.id DESC'
      // let queryParams = formatDateToDDMMYYYY(dateUSE)
      // console.log(queryParams)
      const results = await mysqlDB.query(query,dateUSE);
      console.log(results)
      res.json(results);
    }
    // mysqlDB.query('SELECT * FROM face_detection JOIN employee ON face_detection.name = employee.employee_name ORDER BY DESC', (error, results, fields) => {
    //   if (error) {
    //     console.error(error);
    //     return res.status(500).send('Internal Server Error');
    //   }
    //   // console.log(results);
    //   // res.status(200).json(results); 
    // });
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

  let { dateStart, dateStop, emotion } = req.query;
  dateStart = typeof dateStart === 'string' ? formatDateToDDMMYYYY(dateStart) : null;
  dateStop = typeof dateStop === 'string' ? formatDateToDDMMYYYY(dateStop) : formatDateToDDMMYYYY(today);

  let queryParams = [];
  let query = 'SELECT * FROM face_detection JOIN employee ON face_detection.name = employee.employee_name WHERE name != "unknown" AND employee.status = "ON"';

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
  queryParams.push(emotion);
  // console.log('Query:', query);
  // console.log('Query Parameters:', queryParams);
  mysqlDB.query
  try {
    if (emotion) {
      query += ' AND face_detection.expression = ?'
      const results = await mysqlDB.query(query, [queryParams[0], queryParams[1], queryParams[2]]);
      res.json(results);
    } else {
      const results = await mysqlDB.query(query, [queryParams[0], queryParams[1]]);
      res.json(results);
    }
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
  });
});
app.get('/checknameOff', (req, res) => {
  const labelsDir = path.join(process.cwd(), 'statusoff');
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
app.use('/getENV', express.static('envImgStore'));
app.use('/getImageFolder', express.static('labels'));

//???
app.use('/getDetectedSingleFaceKnown', express.static('knownImgStore'));

const getFilesInDirectory = async (dirPath) => {
  try {
    const files = await fs.promises.readdir(dirPath);
    return files.filter(file => path.extname(file).toLowerCase() === '.png' || '.jpg');
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

    const newImageName = `${folderName}-${dateTimeString}.jpg`;
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