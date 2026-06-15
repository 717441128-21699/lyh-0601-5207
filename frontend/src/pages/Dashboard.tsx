import { useEffect } from 'react';
import { Row, Col, Statistic, Card, List, Tag, Button } from 'antd';
import {
  MoneyCollectOutlined,
  RiseOutlined,
  CalendarOutlined,
  WarningOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useDebtStore } from '../store/useDebtStore';
import { generateRepaymentSchedule } from '../utils/calculator';
import dayjs from 'dayjs';

export default function Dashboard() {
  const { debts, upcomingPayments, fetchDebts, fetchUpcomingPayments } = useDebtStore();

  useEffect(() => {
    fetchDebts();
    fetchUpcomingPayments(14);
  }, [fetchDebts, fetchUpcomingPayments]);

  const totalPrincipal = debts.reduce((sum, debt) => sum + debt.principal, 0);
  const totalMonthlyPayment = debts.reduce((sum, debt) => {
    const calc = generateRepaymentSchedule(debt);
    return sum + calc.monthlyPayment;
  }, 0);
  const totalInterest = debts.reduce((sum, debt) => {
    const calc = generateRepaymentSchedule(debt);
    return sum + calc.totalInterest;
  }, 0);

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>📊 财务总览</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="负债总额"
              value={totalPrincipal}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#cf1322' }}
              prefix={<MoneyCollectOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="每月还款"
              value={totalMonthlyPayment}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#fa8c16' }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="总利息支出"
              value={totalInterest}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#faad14' }}
              prefix={<RiseOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="债务笔数"
              value={debts.length}
              suffix="笔"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <WarningOutlined style={{ marginRight: 8 }} />
                即将到期的还款
              </span>
            }
            extra={
              <Link to="/reminders">
                查看全部 <ArrowRightOutlined />
              </Link>
            }
          >
            {upcomingPayments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🎉</div>
                <div className="empty-state-text">暂无即将到期的还款</div>
              </div>
            ) : (
              <List
                dataSource={upcomingPayments}
                renderItem={(item) => (
                  <List.Item
                    className={item.daysRemaining <= 3 ? 'upcoming-payment urgent' : 'upcoming-payment'}
                  >
                    <List.Item.Meta
                      title={item.debtName}
                      description={`还款日: ${dayjs(item.dueDate).format('YYYY-MM-DD')}`}
                    />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 'bold', color: '#cf1322' }}>
                        ¥{item.amount.toFixed(2)}
                      </div>
                      <Tag color={item.daysRemaining <= 3 ? 'red' : 'orange'}>
                        {item.daysRemaining === 0 ? '今天到期' : `${item.daysRemaining}天后`}
                      </Tag>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <MoneyCollectOutlined style={{ marginRight: 8 }} />
                我的债务
              </span>
            }
            extra={
              <Link to="/debts">
                管理债务 <ArrowRightOutlined />
              </Link>
            }
          >
            {debts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <div className="empty-state-text">还没有添加债务</div>
                <Link to="/debts/new">
                  <Button type="primary" style={{ marginTop: 16 }}>
                    添加第一笔债务
                  </Button>
                </Link>
              </div>
            ) : (
              <List
                dataSource={debts.slice(0, 5)}
                renderItem={(debt) => {
                  const calc = generateRepaymentSchedule(debt);
                  return (
                    <List.Item
                      actions={[
                        <Link to={`/debts/${debt.id}/edit`}>编辑</Link>,
                        <Link to="/schedule">查看计划</Link>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <span>
                            <Tag className="debt-type-tag">
                              {debt.type === 'credit_card' && '💳'}
                              {debt.type === 'mortgage' && '🏠'}
                              {debt.type === 'car_loan' && '🚗'}
                              {debt.type === 'personal_loan' && '💰'}
                              {debt.type === 'other' && '📋'}
                              {debt.name}
                            </Tag>
                          </span>
                        }
                        description={`利率: ${debt.annualRate}% | 期限: ${debt.termMonths}个月 | 月供: ¥${calc.monthlyPayment.toFixed(2)}`}
                      />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 'bold' }}>
                          ¥{debt.principal.toLocaleString()}
                        </div>
                        <div style={{ color: '#999', fontSize: 12 }}>
                          总利息: ¥{calc.totalInterest.toFixed(0)}
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
