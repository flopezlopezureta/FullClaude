
const fs = require('fs');
const path = require('path');

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        getFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const files = getFiles('.');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  
  // Find all components that look like icons (Icon*)
  const iconMatches = content.match(/<Icon[A-Z][a-zA-Z]+/g);
  if (iconMatches) {
    const uniqueIcons = [...new Set(iconMatches.map(m => m.slice(1)))];
    uniqueIcons.forEach(icon => {
        const isDefined = content.includes(`const ${icon}`) || content.includes(`function ${icon}`);
        const isImported = content.includes(icon) && content.includes('import') && content.includes('Icon');
        
        if (!isDefined && !isImported) {
            console.log(`Icon ${icon} used in ${file} might be missing import`);
        }
    });
  }
});
