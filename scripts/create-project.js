// Создаёт проект Apps Script и привязывает к нему папку src/.
// clasp create после создания скачивает дефолтные файлы и затирает наш
// src/appsscript.json, поэтому сохраняем манифест и возвращаем его обратно.
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifestPath = path.join(root, 'src', 'appsscript.json');
const stubPaths = ['Code.js', 'Code.gs'].map((name) => path.join(root, 'src', name));
const manifest = fs.readFileSync(manifestPath, 'utf8');

try {
  execSync('npx clasp create --type standalone --title "Morning Digest" --rootDir src', { cwd: root, stdio: 'inherit' });
} finally {
  fs.writeFileSync(manifestPath, manifest);
  // Пустой Code.js с myFunction() из шаблона Google нам не нужен.
  for (const stubPath of stubPaths) {
    if (fs.existsSync(stubPath) && fs.readFileSync(stubPath, 'utf8').includes('function myFunction')) {
      fs.rmSync(stubPath);
    }
  }
}

console.log('\nПроект создан. Дальше: npm run push');
