import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  CreditCardOutlined,
  CalculatorOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  BellOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import DebtList from './pages/DebtList';
import DebtForm from './pages/DebtForm';
import RepaymentSchedule from './pages/RepaymentSchedule';
import Strategy from './pages/Strategy';
import PrepaymentSimulator from './pages/PrepaymentSimulator';
import Repayments from './pages/Repayments';
import Reminders from './pages/Reminders';
import Reports from './pages/Reports';

const { Header, Content, Sider } = Layout;

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: <Link to="/">总览</Link>,
  },
  {
    key: '/debts',
    icon: <CreditCardOutlined />,
    label: <Link to="/debts">债务管理</Link>,
  },
  {
    key: '/schedule',
    icon: <CalculatorOutlined />,
    label: <Link to="/schedule">还款计划</Link>,
  },
  {
    key: '/strategy',
    icon: <ThunderboltOutlined />,
    label: <Link to="/strategy">智能推荐</Link>,
  },
  {
    key: '/prepayment',
    icon: <RiseOutlined />,
    label: <Link to="/prepayment">提前还款</Link>,
  },
  {
    key: '/repayments',
    icon: <FileTextOutlined />,
    label: <Link to="/repayments">还款记录</Link>,
  },
  {
    key: '/reminders',
    icon: <BellOutlined />,
    label: <Link to="/reminders">提醒设置</Link>,
  },
  {
    key: '/reports',
    icon: <FileTextOutlined />,
    label: <Link to="/reports">月度报告</Link>,
  },
];

function App() {
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div
          style={{
            height: 64,
            margin: 16,
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: borderRadiusLG,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold',
          }}
        >
          💳 债务管家
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0 }}>个人债务管理与财务健康</h2>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/debts" element={<DebtList />} />
            <Route path="/debts/new" element={<DebtForm />} />
            <Route path="/debts/:id/edit" element={<DebtForm />} />
            <Route path="/schedule" element={<RepaymentSchedule />} />
            <Route path="/strategy" element={<Strategy />} />
            <Route path="/prepayment" element={<PrepaymentSimulator />} />
            <Route path="/repayments" element={<Repayments />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
