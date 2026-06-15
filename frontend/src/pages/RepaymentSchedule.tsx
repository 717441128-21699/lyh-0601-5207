import { useEffect, useState } from 'react';
import { Select, Table, Card, Row, Col, Statistic, Tag, Empty, Button, Space, Modal, message } from 'antd';
import { DownloadOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useDebtStore } from '../store/useDebtStore';
import { Debt, RepaymentScheduleItem, DebtCalculationResult } from '../types';
import { debtApi } from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

export default function RepaymentSchedule() {
  const { debts, fetchDebts, loading } = useDebtStore();
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<DebtCalculationResult | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [previewModal, setPreviewModal] = useState<{ visible: boolean; item: RepaymentScheduleItem | null }>({
    visible: false,
    item: null,
  });

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  useEffect(() => {
    if (selectedDebtId) {
      loadSchedule(selectedDebtId);
    } else {
      setScheduleData(null);
    }
  }, [selectedDebtId]);

  const loadSchedule = async (debtId: string) => {
    try {
      const response = await debtApi.getSchedule(debtId);
      if (response.success && response.data) {
        setScheduleData(response.data);
      }
    } catch (error) {
      message.error('加载还款计划失败');
    }
  };

  const selectedDebt = debts.find((d) => d.id === selectedDebtId);

  const filteredSchedule = scheduleData
    ? scheduleData.schedule.filter((item) => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'paid') return item.isPaid;
        if (filterStatus === 'unpaid') return !item.isPaid;
        return true;
      })
    : [];

  const columns: ColumnsType<RepaymentScheduleItem> = [
    {
      title: '期数',
      dataIndex: 'period',
      key: 'period',
      width: 80,
      render: (value) => <span style={{ fontWeight: 'bold' }}>第{value}期</span>,
    },
    {
      title: '还款日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (value) => dayjs(value).format('YYYY-MM-DD'),
    },
    {
      title: '还款金额',
      dataIndex: 'payment',
      key: 'payment',
      width: 120,
      render: (value) => <span style={{ fontWeight: 'bold' }}>¥{value.toFixed(2)}</span>,
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
      title: '额外还款',
      dataIndex: 'extraPayment',
      key: 'extraPayment',
      width: 120,
      render: (value) =>
        value ? <Tag color="green">+¥{value.toFixed(2)}</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '状态',
      dataIndex: 'isPaid',
      key: 'isPaid',
      width: 100,
      render: (value) =>
        value ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已还
          </Tag>
        ) : (
          <Tag icon={<ClockCircleOutlined />} color="warning">
            待还
          </Tag>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => setPreviewModal({ visible: true, item: record })}>
          详情
        </Button>
      ),
    },
  ];

  const exportSchedule = () => {
    if (!scheduleData || !selectedDebt) return;

    const headers = ['期数', '还款日期', '还款金额', '本金', '利息', '剩余本金', '额外还款', '状态'];
    const rows = scheduleData.schedule.map((item) => [
      `第${item.period}期`,
      item.date,
      item.payment.toFixed(2),
      item.principal.toFixed(2),
      item.interest.toFixed(2),
      item.remainingPrincipal.toFixed(2),
      item.extraPayment ? item.extraPayment.toFixed(2) : '0.00',
      item.isPaid ? '已还' : '待还',
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedDebt.name}-还款计划表.csv`;
    link.click();
  };

  const paidCount = scheduleData?.schedule.filter((s) => s.isPaid).length || 0;
  const totalPaid = scheduleData?.schedule.filter((s) => s.isPaid).reduce((sum, s) => sum + s.payment, 0) || 0;

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>📅 还款计划表</h2>

      <Card style={{ marginBottom: 24 }}>
        <Space wrap>
          <span>选择债务:</span>
          <Select
            placeholder="请选择债务"
            style={{ width: 250 }}
            value={selectedDebtId}
            onChange={setSelectedDebtId}
          >
            {debts.map((debt) => (
              <Option key={debt.id} value={debt.id}>
                {debt.name} - ¥{debt.principal.toLocaleString()}
              </Option>
            ))}
          </Select>
          {scheduleData && (
            <>
              <span>筛选:</span>
              <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 120 }}>
                <Option value="all">全部</Option>
                <Option value="paid">已还</Option>
                <Option value="unpaid">待还</Option>
              </Select>
              <Button icon={<DownloadOutlined />} onClick={exportSchedule}>
                导出CSV
              </Button>
            </>
          )}
        </Space>
      </Card>

      {selectedDebt && scheduleData ? (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={6}>
              <Card className="stat-card">
                <Statistic
                  title="每月还款"
                  value={scheduleData.monthlyPayment}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card className="stat-card">
                <Statistic
                  title="还款总额"
                  value={scheduleData.totalPayment}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card className="stat-card">
                <Statistic
                  title="利息总额"
                  value={scheduleData.totalInterest}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card className="stat-card">
                <Statistic
                  title="还款进度"
                  value={paidCount}
                  suffix={`/ ${scheduleData.schedule.length}期`}
                  valueStyle={{ color: '#52c41a' }}
                />
                <div style={{ color: '#666', fontSize: 12 }}>
                  已还 ¥{totalPaid.toFixed(2)}
                </div>
              </Card>
            </Col>
          </Row>

          <Card>
            <Table
              columns={columns}
              dataSource={filteredSchedule}
              rowKey="period"
              loading={loading}
              pagination={{
                pageSize: 12,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 期`,
              }}
              scroll={{ x: 1000 }}
              rowClassName={(record) => (record.isPaid ? 'paid-row' : '')}
            />
          </Card>
        </>
      ) : (
        <Card>
          <Empty description="请选择一个债务查看还款计划表" />
        </Card>
      )}

      <Modal
        title="还款详情"
        open={previewModal.visible}
        onCancel={() => setPreviewModal({ visible: false, item: null })}
        footer={[
          <Button key="close" onClick={() => setPreviewModal({ visible: false, item: null })}>
            关闭
          </Button>,
        ]}
      >
        {previewModal.item && (
          <div>
            <p style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>
              第{previewModal.item.period}期 - {dayjs(previewModal.item.date).format('YYYY年MM月DD日')}
            </p>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small">
                  <div style={{ color: '#666' }}>还款金额</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#cf1322' }}>
                    ¥{previewModal.item.payment.toFixed(2)}
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <div style={{ color: '#666' }}>其中本金</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
                    ¥{previewModal.item.principal.toFixed(2)}
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <div style={{ color: '#666' }}>其中利息</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#fa8c16' }}>
                    ¥{previewModal.item.interest.toFixed(2)}
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <div style={{ color: '#666' }}>剩余本金</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
                    ¥{previewModal.item.remainingPrincipal.toFixed(2)}
                  </div>
                </Card>
              </Col>
            </Row>
            {previewModal.item.extraPayment && (
              <div style={{ marginTop: 16, padding: 12, background: '#f6ffed', borderRadius: 8 }}>
                <div style={{ color: '#52c41a', fontWeight: 'bold' }}>
                  💰 提前还款: ¥{previewModal.item.extraPayment.toFixed(2)}
                </div>
              </div>
            )}
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              {previewModal.item.isPaid ? (
                <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 14, padding: '4px 12px' }}>
                  已还款
                </Tag>
              ) : (
                <Tag icon={<ClockCircleOutlined />} color="warning" style={{ fontSize: 14, padding: '4px 12px' }}>
                  待还款
                </Tag>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
