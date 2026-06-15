import { useEffect, useState } from 'react';
import { Select, Card, Row, Col, Statistic, Button, InputNumber, Radio, Empty, Space, message, Table, Tag } from 'antd';
import { RiseOutlined, CalculatorOutlined, ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useDebtStore } from '../store/useDebtStore';
import { debtApi } from '../services/api';
import { PrepaymentSimulationResult, RepaymentScheduleItem } from '../types';

const { Option } = Select;

export default function PrepaymentSimulator() {
  const { debts, fetchDebts } = useDebtStore();
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [prepaymentAmount, setPrepaymentAmount] = useState<number>(10000);
  const [prepaymentPeriod, setPrepaymentPeriod] = useState<number>(1);
  const [reduceMethod, setReduceMethod] = useState<'reduce_term' | 'reduce_payment'>('reduce_term');
  const [result, setResult] = useState<PrepaymentSimulationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const simulate = async () => {
    if (!selectedDebtId) {
      message.warning('请先选择债务');
      return;
    }
    if (prepaymentAmount <= 0) {
      message.warning('请输入提前还款金额');
      return;
    }

    setLoading(true);
    try {
      const response = await debtApi.simulatePrepayment(
        selectedDebtId,
        prepaymentAmount,
        prepaymentPeriod,
        reduceMethod
      );
      if (response.success && response.data) {
        setResult(response.data);
        message.success('模拟计算完成');
      }
    } catch (error) {
      message.error('计算失败');
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<RepaymentScheduleItem> = [
    {
      title: '期数',
      dataIndex: 'period',
      key: 'period',
      width: 80,
      render: (value) => `第${value}期`,
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
    },
    {
      title: '月供',
      dataIndex: 'payment',
      key: 'payment',
      width: 120,
      render: (value, record) => (
        <span style={{ color: record.extraPayment ? '#52c41a' : 'inherit', fontWeight: 'bold' }}>
          ¥{value.toFixed(2)}
        </span>
      ),
    },
    {
      title: '本金',
      dataIndex: 'principal',
      key: 'principal',
      width: 120,
      render: (value) => <span style={{ color: '#1890ff' }}>¥{value.toFixed(2)}</span>,
    },
    {
      title: '利息',
      dataIndex: 'interest',
      key: 'interest',
      width: 120,
      render: (value) => <span style={{ color: '#fa8c16' }}>¥{value.toFixed(2)}</span>,
    },
    {
      title: '剩余本金',
      dataIndex: 'remainingPrincipal',
      key: 'remainingPrincipal',
      width: 140,
      render: (value) => <span style={{ color: '#cf1322' }}>¥{value.toFixed(2)}</span>,
    },
    {
      title: '提前还款',
      dataIndex: 'extraPayment',
      key: 'extraPayment',
      width: 120,
      render: (value) =>
        value ? <Tag color="green">+¥{value.toFixed(2)}</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>💰 提前还款模拟器</h2>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} md={8}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>选择债务</div>
            <Select
              placeholder="请选择债务"
              style={{ width: '100%' }}
              value={selectedDebtId}
              onChange={setSelectedDebtId}
            >
              {debts.map((debt) => (
                <Option key={debt.id} value={debt.id}>
                  {debt.name} - 本金¥{debt.principal.toLocaleString()} - 利率{debt.annualRate}%
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>提前还款金额</div>
            <InputNumber
              min={0}
              step={1000}
              value={prepaymentAmount}
              onChange={(value) => setPrepaymentAmount(value || 0)}
              prefix="¥"
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={4}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>还款期数</div>
            <InputNumber
              min={1}
              value={prepaymentPeriod}
              onChange={(value) => setPrepaymentPeriod(value || 1)}
              suffix="期"
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={6}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>还款方式</div>
            <Radio.Group value={reduceMethod} onChange={(e) => setReduceMethod(e.target.value)}>
              <Radio.Button value="reduce_term">缩短期限</Radio.Button>
              <Radio.Button value="reduce_payment">减少月供</Radio.Button>
            </Radio.Group>
          </Col>
          <Col xs={24} md={4}>
            <Button type="primary" size="large" icon={<CalculatorOutlined />} onClick={simulate} loading={loading} block>
              开始模拟
            </Button>
          </Col>
        </Row>
      </Card>

      {result ? (
        <>
          <Card title="📊 对比分析" style={{ marginBottom: 24 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={6}>
                <Card className="compare-card">
                  <div style={{ color: '#666' }}>原方案月供</div>
                  <div className="compare-value">¥{result.original.monthlyPayment.toFixed(2)}</div>
                  <Tag>原方案</Tag>
                </Card>
              </Col>
              <Col xs={24} sm={6}>
                <Card
                  className={`compare-card ${
                    result.afterPrepayment.monthlyPayment < result.original.monthlyPayment ? 'positive' : ''
                  }`}
                >
                  <div style={{ color: '#666' }}>提前还款后月供</div>
                  <div className="compare-value">¥{result.afterPrepayment.monthlyPayment.toFixed(2)}</div>
                  {reduceMethod === 'reduce_payment' && (
                    <Tag color="green">
                      <ArrowDownOutlined /> ¥{(result.original.monthlyPayment - result.afterPrepayment.monthlyPayment).toFixed(2)}
                    </Tag>
                  )}
                </Card>
              </Col>
              <Col xs={24} sm={6}>
                <Card className="compare-card">
                  <div style={{ color: '#666' }}>原期限</div>
                  <div className="compare-value">{result.original.totalMonths}期</div>
                  <Tag>原方案</Tag>
                </Card>
              </Col>
              <Col xs={24} sm={6}>
                <Card
                  className={`compare-card ${result.difference.monthsSaved > 0 ? 'positive' : ''}`}
                >
                  <div style={{ color: '#666' }}>提前还款后期限</div>
                  <div className="compare-value">{result.afterPrepayment.totalMonths}期</div>
                  {result.difference.monthsSaved > 0 && (
                    <Tag color="green">
                      <ArrowUpOutlined /> 缩短{result.difference.monthsSaved}期
                    </Tag>
                  )}
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} sm={8}>
                <Card className="compare-card negative">
                  <div style={{ color: '#666' }}>原总利息</div>
                  <div className="compare-value">¥{result.original.totalInterest.toFixed(2)}</div>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card className="compare-card">
                  <div style={{ color: '#666' }}>提前还款后总利息</div>
                  <div className="compare-value">¥{result.afterPrepayment.totalInterest.toFixed(2)}</div>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card className="compare-card positive">
                  <div style={{ color: '#666' }}>节省利息</div>
                  <div className="compare-value" style={{ color: '#52c41a' }}>
                    ¥{result.difference.interestSaved.toFixed(2)}
                  </div>
                  <Tag color="green">
                    <RiseOutlined /> 节省{((result.difference.interestSaved / result.original.totalInterest) * 100).toFixed(1)}%
                  </Tag>
                </Card>
              </Col>
            </Row>
          </Card>

          <Card title={`📅 新还款计划表 (前24期) - 提前还款¥${prepaymentAmount.toLocaleString()}在第${prepaymentPeriod}期`}>
            <Table
              columns={columns}
              dataSource={result.newSchedule.slice(0, 24)}
              rowKey="period"
              pagination={false}
              scroll={{ x: 900 }}
              rowClassName={(record) => (record.extraPayment ? 'paid-row' : '')}
            />
            {result.newSchedule.length > 24 && (
              <div style={{ textAlign: 'center', padding: 16, color: '#999' }}>
                ... 还有 {result.newSchedule.length - 24} 期的还款计划
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <Empty description="请选择债务并填写提前还款金额，点击开始模拟查看结果" />
        </Card>
      )}
    </div>
  );
}
