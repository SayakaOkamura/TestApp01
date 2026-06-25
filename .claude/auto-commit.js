const { execSync } = require('child_process');

const ROOT = 'C:\\Users\\SayakaOkamura\\Documents\\claude-workspace\\TestApp01';

try {
  execSync('git add -A', { cwd: ROOT, stdio: 'pipe' });

  const staged = execSync('git diff --cached --name-only', { cwd: ROOT, stdio: 'pipe' })
    .toString().trim();

  if (!staged) return;

  const files = staged.split('\n');
  const label = files.slice(0, 3).map(f => f.split('/').pop()).join(', ');
  const suffix = files.length > 3 ? ` 他${files.length - 3}件` : '';
  const msg = `auto: ${label}${suffix}`;

  execSync(`git commit -m "${msg}"`, { cwd: ROOT, stdio: 'pipe' });
  console.log(`[auto-commit] ${msg}`);
} catch (_) {
  // コミット不要 or git エラーは無視
}
