const fs = require("fs");

function read(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, { flag: "a+" }, (err, data) => {
      if (err) return reject(err);
      const object = data.toString() ? JSON.parse(data.toString()) : [];
      resolve(object);
    });
  });
}

async function write(data, filePath) {
  return new Promise((resolve, reject) => {
    const dataString = JSON.stringify(data);
    fs.writeFile(filePath, dataString, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

exports.read = read;
exports.write = write;
