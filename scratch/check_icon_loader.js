
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
  if (content.includes('IconLoader')) {
    const hasImport = content.includes('import') && content.includes('IconLoader') && (content.includes("from './Icon'") || content.includes("from '../Icon'") || content.includes("from '../../Icon'"));
    if (!hasImport) {
        // Check if it's defined in the file
        if (!content.includes('const IconLoader') && !content.includes('function IconLoader')) {
            console.log(`Potential Missing Import in ${file}`);
        }
    }
  }
});
