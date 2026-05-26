const { execSync } = require('child_process');
const port = process.env.PORT || 3000;
execSync(`npx serve -s build -l tcp://0.0.0.0:${port}`, { stdio: 'inherit' });
