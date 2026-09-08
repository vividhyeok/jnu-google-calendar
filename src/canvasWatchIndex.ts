import { runCanvasWatch } from './canvasWatch';
import { notifyDiscord } from './notify';

const deadline = setTimeout(() => {
  console.error('Canvas watch failed: overall execution timeout');
  process.exit(1);
}, 180_000);
deadline.unref();

runCanvasWatch()
  .then(code => { process.exitCode = code; })
  .catch(async error => {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error('Canvas watch failed: ' + message);
    await notifyDiscord('JNU Canvas 알림 감시 실패. Cloud Run 실행 로그를 확인하세요.', 'JNU Canvas 알리미');
    process.exitCode = 1;
  });
