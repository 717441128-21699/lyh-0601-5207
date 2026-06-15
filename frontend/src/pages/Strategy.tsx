import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, InputNumber, Select, Empty, Tag, List, Space, message, Radio } from 'antd';
import { ThunderboltOutlined, BulbOutlined, SaveOutlined } from '@ant-design/icons';
import { useDebtStore } from '../store/useDebtStore';
import { debtApi } from '../services/api';
import { RepaymentStrategy, RepaymentStrategyResult, RepaymentStrategyLabels } from '../types';

const { Option } = Select;

export default function Strategy() {
  const { debts, fetchDebts } = useDebtStore();
  const [strategy, setStrategy] = useState<RepaymentStrategy>('avalanche');
  const [extraMonthlyAmount, setExtraMonthlyAmount] = useState<number>(500);
  const [result, setResult] = useState<RepaymentStrategyResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const calculateStrategy = async () => {
    if (debts.length === 0) {
      message.warning('请先添加债务');
      return;
    }

    setLoading(true);
    try {
      const response = await debtApi.getStrategy(strategy, extraMonthlyAmount);
      if (response.success && response.data) {
        setResult(response.data);
        message.success('计算完成');
      }
    } catch (error) {
      message.error('计算失败');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (debtName: string) => {
    if (debtName.includes('信用')) return '💳';
    if (debtName.includes('房')) return '🏠';
    if (debtName.includes('车')) return '🚗';
    return '💰';
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>⚡ 智能还款推荐</h2>

      <Card style={{ marginBottom: 24 }}>
        <Space wrap size="large">
          <div>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>选择还款策略</div>
            <Radio.Group value={strategy} onChange={(e) => setStrategy(e.target.value)}>
              <Radio.Button value="avalanche">
                <ThunderboltOutlined /> 雪崩法
              </Radio.Button>
              <Radio.Button value="snowball">
                <BulbOutlined /> 雪球法
              </Radio.Button>
            </Radio.Group>
          </div>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>每月额外还款</div>
            <InputNumber
              min={0}
              step={100}
              value={extraMonthlyAmount}
              onChange={(value) => setExtraMonthlyAmount(value || 0)}
              prefix="¥"
              style={{ width: 150 }}
            />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <Button type="primary" size="large" icon={<SaveOutlined />} onClick={calculateStrategy} loading={loading}>
              开始计算
            </Button>
          </div>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card
            className={`strategy-card ${strategy === 'avalanche' ? 'selected' : ''}`}
            onClick={() => setStrategy('avalanche')}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <ThunderboltOutlined style={{ fontSize: 32, color: '#1890ff', marginRight: 12 }} />
              <div>
                <h3 style={{ margin: 0 }}>雪崩法</h3>
                <p style={{ margin: 0, color: '#666', fontSize: 13 }}>优先偿还利率最高的债务</p>
              </div>
            </div>
            <p style={{ color: '#666', fontSize: 13 }}>
              数学上最优的还款方式，将额外资金优先用于偿还利率最高的债务，能够最大化节省利息支出。
            </p>
            <Tag color="blue">推荐：追求最大利息节省</Tag>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            className={`strategy-card ${strategy === 'snowball' ? 'selected' : ''}`}
            onClick={() => setStrategy('snowball')}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <BulbOutlined style={{ fontSize: 32, color: '#faad14', marginRight: 12 }} />
              <div>
                <h3 style={{ margin: 0 }}>雪球法</h3>
                <p style={{ margin: 0, color: '#666', fontSize: 13 }}>优先偿还余额最小的债务</p>
              </div>
            </div>
            <p style={{ color: '#666', fontSize: 13 }}>
              心理学上最优的还款方式，将额外资金优先用于偿还余额最小的债务，快速获得成就感，更能坚持。
            </p>
            <Tag color="orange">推荐：需要动力坚持还款</Tag>
          </Card>
        </Col>
      </Row>

      {result ? (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={6}>
              <Card className="stat-card">
                <Statistic
                  title="原方案总利息"
                  value={result.originalTotalInterest}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card className="stat-card">
                <Statistic
                  title={`${result.strategyName}总利息`}
                  value={result.totalInterest}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card className="stat-card positive">
                <Statistic
                  title="可节省利息"
                  value={result.savedInterest}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card className="stat-card">
                <Statistic
                  title="还款期限"
                  value={result.schedule.length}
                  suffix="个月"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
          </Row>

          <Card title="🎯 推荐还款顺序" style={{ marginBottom: 24 }}>
            <p style={{ color: '#666', marginBottom: 16 }}>{result.description}</p>
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 4 }}
              dataSource={result.orderedDebts}
              renderItem={(item) => (
                <List.Item>
                  <Card
                    style={{
                      textAlign: 'center',
                      background: item.priority === 1 ? '#e6f7ff' : '#fafafa',
                      border: item.priority === 1 ? '2px solid #1890ff' : '1px solid #d9d9d9',
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{getTypeIcon(item.debtName)}</div>
                    <Tag
                      color={item.priority === 1 ? 'blue' : 'default'}
                      style={{ fontSize: 14, marginBottom: 8 }}
                    >
                      优先级 #{item.priority}
                    </Tag>
                    <div style={{ fontWeight: 'bold' }}>{item.debtName}</div>
                  </Card>
                </List.Item>
              )}
            />
          </Card>

          <Card title="📅 还款计划预览 (前12个月)">
            <List
              dataSource={result.schedule.slice(0, 12)}
              renderItem={(month) => (
                <List.Item
                  style={{ borderBottom: '1px solid #f0f0f0' }}
                  extra={
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 'bold', color: '#cf1322' }}>
                        ¥{month.totalPayment.toFixed(2)}
                      </div>
                    </div>
                  }
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color="blue">第{month.month}个月</Tag>
                        <span style={{ color: '#666' }}>{month.date}</span>
                      </Space>
                    }
                    description={
                      <Space wrap size={[8, 8]} style={{ marginTop: 8 }}>
                        {month.payments.map((payment, idx) => (
                          <Tag key={idx} color={payment.extraPayment > 0 ? 'green' : 'default'}>
                            {payment.debtName}: ¥{payment.payment.toFixed(0)}
                            {payment.extraPayment > 0 && ` (+¥${payment.extraPayment.toFixed(0)})`}
                          </Tag>
                        ))}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
            {result.schedule.length > 12 && (
              <div style={{ textAlign: 'center', padding: 16, color: '#999' }}>
                ... 还有 {result.schedule.length - 12} 个月的还款计划
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <Empty description="点击&quot;开始计算&quot;按钮，获取个性化还款策略推荐" />
        </Card>
      )}
    </div>
  );
}
