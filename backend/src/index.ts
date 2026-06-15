import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import debtsRouter from './routes/debts';
import repaymentsRouter from './routes/repayments';
import remindersRouter from './routes/reminders';
import reportsRouter from './routes/reports';
import { startScheduler, getUpcomingPaymentsForNotification } from './services/scheduler';

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '债务管理系统API运行正常', timestamp: new Date().toISOString() });
});

app.get('/api/notifications/upcoming', (req, res) => {
  try {
    const payments = getUpcomingPaymentsForNotification();
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.use('/api/debts', debtsRouter);
app.use('/api/repayments', repaymentsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/reports', reportsRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'API端点不存在' });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`🚀 债务管理系统后端服务已启动`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`📁 上传目录: ${uploadsDir}`);
  startScheduler();
});

export default app;
