import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Table, Button, Tag, Popconfirm, Card, Row, Col, Statistic, Select, InputNumber, Space, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalculatorOutlined, MoneyCollectOutlined, RiseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useDebtStore } from '../store/useDebtStore';
import { Debt, DebtTypeLabels, RepaymentMethodLabels } from '../types';
import { generateRepaymentSchedule } from '../utils/calculator';

const { Option } = Select;

export default function DebtList() {
  const { debts, loading, fetchDebts, deleteDebt } = useDebtStore();
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [extraPayment, setExtraPayment] = useState<number>(0);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const filteredDebts = filterType === 'all' ? debts : debts.filter((d) => d.type === filterType);

  const handleDelete = async (id: string) => {
    const success = await deleteDebt(id);
    if (success) {
      message.success('删除成功');
    } else {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<Debt> = [
    {
      title: '债务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <Tag color={getTypeColor(record.type)}>
            {getTypeIcon(record.type)} {DebtTypeLabels[record.type]}
          </Tag>
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '剩余本金',
      key: 'remainingPrincipal',
      width: 140,
      render: (_, record) => {
        const remaining = record.remainingPrincipal !== undefined ? record.remainingPrincipal : record.principal;
        const hasPaid = remaining < record.principal;
        return (
          <div>
            <div style={{ fontWeight: 'bold', color: hasPaid ? '#cf1322' : undefined }}>
              ¥{remaining.toLocaleString()}
            </div>
            {hasPaid && (
              <div style={{ fontSize: 11, color: '#52c41a' }}>
                已还 ¥{(record.principal - remaining).toLocaleString()}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: '年利率',
      dataIndex: 'annualRate',
      key: 'annualRate',
      width: 100,
      render: (value) => <Tag color="orange">{value}%</Tag>,
    },
    {
      title: '期限',
      dataIndex: 'termMonths',
      key: 'termMonths',
      width: 100,
      render: (value) => `${value}个月`,
    },
    {
      title: '还款方式',
      dataIndex: 'repaymentMethod',
      key: 'repaymentMethod',
      width: 120,
      render: (value) => RepaymentMethodLabels[value],
    },
    {
      title: '月供',
      key: 'monthlyPayment',
      width: 140,
      render: (_, record) => {
        const calc = generateRepaymentSchedule(record);
        return <span style={{ color: '#cf1322', fontWeight: 'bold' }}>¥{calc.monthlyPayment.toFixed(2)}</span>;
      },
    },
    {
      title: '总利息',
      key: 'totalInterest',
      width: 140,
      render: (_, record) => {
        const calc = generateRepaymentSchedule(record);
        return <span style={{ color: '#fa8c16' }}>¥{calc.totalInterest.toFixed(0)}</span>;
      },
    },
    {
      title: '开始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 120,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />}>
            <Link to={`/debts/${record.id}/edit`}>编辑</Link>
          </Button>
          <Button type="link" size="small" icon={<CalculatorOutlined />} onClick={() => setSelectedDebt(record)}>
            计算
          </Button>
          <Popconfirm title="确定删除此债务吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const totalPrincipal = debts.reduce((sum, d) => sum + (d.remainingPrincipal || d.principal), 0);
  const totalInterest = debts.reduce((sum, d) => {
    const calc = generateRepaymentSchedule(d);
    return sum + calc.totalInterest;
  }, 0);
  const totalPayment = totalPrincipal + totalInterest;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>💳 债务管理</h2>
        <Link to="/debts/new">
          <Button type="primary" icon={<PlusOutlined />}>
            添加债务
          </Button>
        </Link>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <Statistic
              title="负债总额"
              value={totalPrincipal}
              precision={2}
              prefix={<MoneyCollectOutlined />}
              suffix="元"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <Statistic
              title="总还款额"
              value={totalPayment}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <Statistic
              title="总利息支出"
              value={totalInterest}
              precision={2}
              prefix={<RiseOutlined />}
              suffix="元"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <span>筛选类型:</span>
            <Select value={filterType} onChange={setFilterType} style={{ width: 150 }}>
              <Option value="all">全部</Option>
              <Option value="credit_card">信用卡</Option>
              <Option value="mortgage">房贷</Option>
              <Option value="car_loan">车贷</Option>
              <Option value="personal_loan">个人贷款</Option>
              <Option value="other">其他</Option>
            </Select>
            <span>共 {filteredDebts.length} 笔债务</span>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={filteredDebts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {selectedDebt && (
        <Card
          title={`📊 ${selectedDebt.name} - 还款计算`}
          style={{ marginTop: 24 }}
          extra={
            <Button onClick={() => setSelectedDebt(null)}>关闭</Button>
          }
        >
          <Space style={{ marginBottom: 16 }}>
            <span>每月额外还款:</span>
            <InputNumber
              min={0}
              step={100}
              value={extraPayment}
              onChange={(value) => setExtraPayment(value || 0)}
              prefix="¥"
            />
            <Button type="primary" onClick={() => {
              const extraMap = new Map<number, number>();
              if (extraPayment > 0) {
                for (let i = 1; i <= selectedDebt.termMonths; i++) {
                  extraMap.set(i, extraPayment);
                }
              }
              const calc = generateRepaymentSchedule(selectedDebt, extraMap);
              message.info(
                `月供: ¥${calc.monthlyPayment.toFixed(2)} | 总期数: ${calc.schedule.length}期 | 总利息: ¥${calc.totalInterest.toFixed(2)}`
              );
            }}>
              重新计算
            </Button>
          </Space>

          {(() => {
            const extraMap = new Map<number, number>();
            if (extraPayment > 0) {
              for (let i = 1; i <= selectedDebt.termMonths; i++) {
                extraMap.set(i, extraPayment);
              }
            }
            const calc = generateRepaymentSchedule(selectedDebt, extraMap);
            const originalCalc = generateRepaymentSchedule(selectedDebt);
            return (
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={6}>
                  <Card className={extraPayment > 0 ? 'compare-card positive' : 'compare-card'}>
                    <div>月供</div>
                    <div className="compare-value">¥{calc.monthlyPayment.toFixed(2)}</div>
                    {extraPayment > 0 && (
                      <div style={{ color: '#52c41a' }}>
                        +¥{extraPayment.toFixed(2)} 额外
                      </div>
                    )}
                  </Card>
                </Col>
                <Col xs={24} sm={6}>
                  <Card className={calc.schedule.length < originalCalc.schedule.length ? 'compare-card positive' : 'compare-card'}>
                    <div>还款期数</div>
                    <div className="compare-value">{calc.schedule.length}期</div>
                    {calc.schedule.length < originalCalc.schedule.length && (
                      <div style={{ color: '#52c41a' }}>
                        减少 {originalCalc.schedule.length - calc.schedule.length} 期
                      </div>
                    )}
                  </Card>
                </Col>
                <Col xs={24} sm={6}>
                  <Card className="compare-card">
                    <div>总还款额</div>
                    <div className="compare-value">¥{calc.totalPayment.toFixed(2)}</div>
                  </Card>
                </Col>
                <Col xs={24} sm={6}>
                  <Card className={calc.totalInterest < originalCalc.totalInterest ? 'compare-card positive' : 'compare-card'}>
                    <div>总利息</div>
                    <div className="compare-value">¥{calc.totalInterest.toFixed(2)}</div>
                    {calc.totalInterest < originalCalc.totalInterest && (
                      <div style={{ color: '#52c41a' }}>
                        节省 ¥{(originalCalc.totalInterest - calc.totalInterest).toFixed(2)}
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            );
          })()}
        </Card>
      )}
    </div>
  );
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'credit_card':
      return '💳';
    case 'mortgage':
      return '🏠';
    case 'car_loan':
      return '🚗';
    case 'personal_loan':
      return '💰';
    default:
      return '📋';
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case 'credit_card':
      return 'blue';
    case 'mortgage':
      return 'green';
    case 'car_loan':
      return 'cyan';
    case 'personal_loan':
      return 'purple';
    default:
      return 'default';
  }
}
