import { useEffect, useState } from 'react';
import {
  Row,
  Col,
  Statistic,
  Card,
  Table,
  Button,
  Select,
  DatePicker,
  Empty,
  Tag,
  message,
  Modal,
} from 'antd';
import {
  FileTextOutlined,
  DownloadOutlined,
  PlusOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  PieChartOutlined,
  DollarOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useDebtStore } from '../store/useDebtStore';
import { reportApi } from '../services/api';
import { MonthlyReport } from '../types';
import dayjs, { Dayjs } from 'dayjs';



export default function Reports() {
  const { monthlyReports, fetchMonthlyReports, generateMonthlyReport, loading } = useDebtStore();
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [generateMonth, setGenerateMonth] = useState<Dayjs | null>(null);

  useEffect(() => {
    fetchMonthlyReports();
  }, [fetchMonthlyReports]);

  useEffect(() => {
    if (monthlyReports.length > 0 && !selectedMonth) {
      setSelectedMonth(monthlyReports[0].month);
    }
  }, [monthlyReports, selectedMonth]);

  useEffect(() => {
    const report = monthlyReports.find((r) => r.month === selectedMonth);
    setSelectedReport(report || null);
  }, [monthlyReports, selectedMonth]);

  const handleGenerateReport = async () => {
    if (!generateMonth) {
      message.warning('请选择要生成报告的月份');
      return;
    }
    const monthStr = generateMonth.format('YYYY-MM');
    const success = await generateMonthlyReport(monthStr);
    if (success) {
      message.success('月度报告生成成功');
      setGenerateModalVisible(false);
      setGenerateMonth(null);
      setSelectedMonth(monthStr);
    }
  };

  const handleDownloadPdf = (month: string) => {
    reportApi.downloadPdf(month);
  };

  const monthOptions = monthlyReports.map((report) => ({
    label: `${report.month} 月度报告`,
    value: report.month,
  }));

  const debtColumns = [
    {
      title: '债务名称',
      dataIndex: 'debtName',
      key: 'debtName',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '期初余额',
      dataIndex: 'beginningBalance',
      key: 'beginningBalance',
      render: (val: number) => <span style={{ color: '#cf1322' }}>¥{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
    {
      title: '期末余额',
      dataIndex: 'endingBalance',
      key: 'endingBalance',
      render: (val: number) => <span style={{ color: '#fa8c16' }}>¥{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
    {
      title: '本月还款',
      dataIndex: 'payment',
      key: 'payment',
      render: (val: number) => <span style={{ color: '#52c41a' }}>¥{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
    {
      title: '本金',
      dataIndex: 'principal',
      key: 'principal',
      render: (val: number) => `¥${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: '利息',
      dataIndex: 'interest',
      key: 'interest',
      render: (val: number) => <span style={{ color: '#faad14' }}>¥{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
  ];

  const renderDebtChangeTag = (change: number) => {
    if (change > 0) {
      return (
        <Tag icon={<ArrowUpOutlined />} color="red">
          增加 ¥{change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Tag>
      );
    } else if (change < 0) {
      return (
        <Tag icon={<ArrowDownOutlined />} color="green">
          减少 ¥{Math.abs(change).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Tag>
      );
    }
    return (
      <Tag icon={<MinusOutlined />} color="default">
        无变化
      </Tag>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          月度报告
        </h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setGenerateModalVisible(true)}
        >
          生成报告
        </Button>
      </div>

      {monthlyReports.length === 0 ? (
        <Card className="empty-state">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <div style={{ fontSize: 18, marginBottom: 8 }}>还没有月度报告</div>
                <div style={{ color: '#999', marginBottom: 16 }}>点击上方按钮生成您的第一份月度负债报告</div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenerateModalVisible(true)}>
                  生成报告
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <Card style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 'bold' }}>选择月份：</span>
              <Select
                style={{ width: 200 }}
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={monthOptions}
                placeholder="请选择月份"
              />
              {selectedReport && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownloadPdf(selectedMonth)}
                >
                  导出 PDF
                </Button>
              )}
            </div>
          </Card>

          {selectedReport && (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                  <Card className="stat-card">
                    <Statistic
                      title={
                        <span>
                          <PieChartOutlined style={{ marginRight: 4 }} />
                          期末负债总额
                        </span>
                      }
                      value={selectedReport.totalDebt}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ color: '#cf1322' }}
                    />
                    <div style={{ marginTop: 8 }}>
                      {renderDebtChangeTag(selectedReport.debtChange)}
                    </div>
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card className="stat-card">
                    <Statistic
                      title={
                        <span>
                          <DollarOutlined style={{ marginRight: 4 }} />
                          本月还款总额
                        </span>
                      }
                      value={selectedReport.monthlyPaymentTotal}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card className="stat-card">
                    <Statistic
                      title={
                        <span>
                          <RiseOutlined style={{ marginRight: 4 }} />
                          本月利息支出
                        </span>
                      }
                      value={selectedReport.interestPaid}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card className="stat-card">
                    <Statistic
                      title={
                        <span>
                          <DollarOutlined style={{ marginRight: 4 }} />
                          本月本金偿还
                        </span>
                      }
                      value={selectedReport.principalPaid}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={8}>
                  <Card title="负债总额变化">
                    <Row gutter={[16, 16]}>
                      <Col span={12}>
                        <Statistic
                          title="上月末总额"
                          value={selectedReport.previousMonthTotalDebt}
                          precision={2}
                          prefix="¥"
                          valueStyle={{ fontSize: 16 }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="本月末总额"
                          value={selectedReport.totalDebt}
                          precision={2}
                          prefix="¥"
                          valueStyle={{ fontSize: 16 }}
                        />
                      </Col>
                    </Row>
                    <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                      <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>本月变化</div>
                      <div style={{ fontSize: 24, fontWeight: 'bold' }}>
                        {renderDebtChangeTag(selectedReport.debtChange)}
                      </div>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Card title="当月还款进度">
                    <Row gutter={[16, 16]}>
                      <Col span={12}>
                        <Statistic
                          title="已还本金"
                          value={selectedReport.principalPaid}
                          precision={2}
                          prefix="¥"
                          valueStyle={{ fontSize: 16, color: '#1890ff' }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="已还利息"
                          value={selectedReport.interestPaid}
                          precision={2}
                          prefix="¥"
                          valueStyle={{ fontSize: 16, color: '#faad14' }}
                        />
                      </Col>
                    </Row>
                    <div style={{ marginTop: 16, padding: 16, background: '#f0f9ff', borderRadius: 8 }}>
                      <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>本金占比</div>
                      <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
                        {selectedReport.monthlyPaymentTotal > 0
                          ? ((selectedReport.principalPaid / selectedReport.monthlyPaymentTotal) * 100).toFixed(1)
                          : 0}%
                      </div>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Card title="利息支出明细">
                    <div style={{ padding: 16, background: '#fff7e6', borderRadius: 8, marginBottom: 16 }}>
                      <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>本月利息支出</div>
                      <div style={{ fontSize: 28, fontWeight: 'bold', color: '#faad14' }}>
                        ¥{selectedReport.interestPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div style={{ color: '#666', fontSize: 13, lineHeight: 1.8 }}>
                      <div>• 利息占还款总额：
                        <strong style={{ color: '#faad14' }}>
                          {selectedReport.monthlyPaymentTotal > 0
                            ? ((selectedReport.interestPaid / selectedReport.monthlyPaymentTotal) * 100).toFixed(1)
                            : 0}%
                        </strong>
                      </div>
                      <div>• 债务笔数：
                        <strong>{selectedReport.debts.length} 笔</strong>
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card
                title={
                  <span>
                    <FileTextOutlined style={{ marginRight: 8 }} />
                    各债务明细
                  </span>
                }
                className="table-container"
              >
                <Table
                  dataSource={selectedReport.debts}
                  columns={debtColumns}
                  rowKey="debtId"
                  pagination={false}
                  summary={(pageData) => {
                    let totalBeginning = 0;
                    let totalEnding = 0;
                    let totalPayment = 0;
                    let totalPrincipal = 0;
                    let totalInterest = 0;

                    pageData.forEach((item) => {
                      totalBeginning += item.beginningBalance;
                      totalEnding += item.endingBalance;
                      totalPayment += item.payment;
                      totalPrincipal += item.principal;
                      totalInterest += item.interest;
                    });

                    return (
                      <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                        <Table.Summary.Cell>合计</Table.Summary.Cell>
                        <Table.Summary.Cell style={{ color: '#cf1322' }}>
                          ¥{totalBeginning.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell style={{ color: '#fa8c16' }}>
                          ¥{totalEnding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell style={{ color: '#52c41a' }}>
                          ¥{totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell>
                          ¥{totalPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell style={{ color: '#faad14' }}>
                          ¥{totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    );
                  }}
                />
              </Card>

              <Card
                style={{ marginTop: 24, background: '#f5f5f5', border: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 48 }}>💡</div>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0' }}>财务建议</h3>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#666', lineHeight: 1.8 }}>
                      {selectedReport.debtChange < 0 && (
                        <li>恭喜！本月债务总额减少了 ¥{Math.abs(selectedReport.debtChange).toLocaleString()}，继续保持良好的还款习惯。</li>
                      )}
                      {selectedReport.debtChange > 0 && (
                        <li>本月债务有所增加，建议控制新增负债，制定更严格的还款计划。</li>
                      )}
                      {selectedReport.interestPaid > 0 && (
                        <li>本月利息支出 ¥{selectedReport.interestPaid.toLocaleString()}，考虑使用<a href="#/strategy">智能还款策略</a>优化还款顺序，减少总利息支出。</li>
                      )}
                      <li>如需加快还款进度，可以使用<a href="#/prepayment">提前还款模拟器</a>计算提前还款的收益。</li>
                      <li>记得设置<a href="#/reminders">还款提醒</a>，避免逾期产生额外费用。</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      <Modal
        title="生成月度报告"
        open={generateModalVisible}
        onOk={handleGenerateReport}
        onCancel={() => {
          setGenerateModalVisible(false);
          setGenerateMonth(null);
        }}
        confirmLoading={loading}
        okText="生成报告"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#666', marginBottom: 16 }}>
            选择要生成报告的月份，系统将根据您的债务和还款记录自动生成该月的负债报告。
          </p>
          <DatePicker
            picker="month"
            style={{ width: '100%' }}
            value={generateMonth}
            onChange={(date) => setGenerateMonth(date)}
            placeholder="请选择月份"
            maxDate={dayjs()}
          />
        </div>
        <div style={{ padding: 12, background: '#e6f7ff', borderRadius: 8, fontSize: 13, color: '#1890ff' }}>
          <strong>提示：</strong>月度报告包含负债总额变化、当月还款进度和利息支出明细。
        </div>
      </Modal>
    </div>
  );
}
