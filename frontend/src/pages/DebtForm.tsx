import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Form, Input, InputNumber, Select, DatePicker, Button, Card, Row, Col, Statistic, message, Space } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, CalculatorOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDebtStore } from '../store/useDebtStore';
import { DebtType, RepaymentMethod, DebtTypeLabels, RepaymentMethodLabels } from '../types';
import { generateRepaymentSchedule } from '../utils/calculator';

const { Option } = Select;
const { TextArea } = Input;

interface FormData {
  name: string;
  type: DebtType;
  principal: number;
  annualRate: number;
  termMonths: number;
  repaymentMethod: RepaymentMethod;
  startDate: dayjs.Dayjs;
  dueDay: number;
  note?: string;
}

export default function DebtForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { debts, createDebt, updateDebt, fetchDebtById, selectedDebt, loading, fetchDebts } = useDebtStore();
  const [form] = Form.useForm<FormData>();
  const [previewData, setPreviewData] = useState<FormData | null>(null);

  const isEdit = !!id;

  useEffect(() => {
    if (isEdit && id) {
      fetchDebtById(id);
    }
  }, [isEdit, id, fetchDebtById]);

  useEffect(() => {
    if (isEdit && selectedDebt) {
      form.setFieldsValue({
        name: selectedDebt.name,
        type: selectedDebt.type,
        principal: selectedDebt.principal,
        annualRate: selectedDebt.annualRate,
        termMonths: selectedDebt.termMonths,
        repaymentMethod: selectedDebt.repaymentMethod,
        startDate: dayjs(selectedDebt.startDate),
        dueDay: selectedDebt.dueDay,
        note: selectedDebt.note,
      });
    }
  }, [isEdit, selectedDebt, form]);

  const handleValuesChange = (_: any, allValues: FormData) => {
    if (allValues.principal && allValues.annualRate && allValues.termMonths && allValues.repaymentMethod && allValues.startDate) {
      setPreviewData(allValues);
    }
  };

  const handleSubmit = async (values: FormData) => {
    const data = {
      name: values.name,
      type: values.type,
      principal: values.principal,
      annualRate: values.annualRate,
      termMonths: values.termMonths,
      repaymentMethod: values.repaymentMethod,
      startDate: values.startDate.format('YYYY-MM-DD'),
      dueDay: values.dueDay,
      note: values.note,
    };

    let success: boolean;
    if (isEdit && id) {
      success = await updateDebt(id, data);
      if (success) {
        message.success('债务更新成功');
      }
    } else {
      success = await createDebt(data);
      if (success) {
        message.success('债务创建成功');
      }
    }

    if (success) {
      fetchDebts();
      navigate('/debts');
    }
  };

  const handlePreview = () => {
    const values = form.getFieldsValue();
    if (values.principal && values.annualRate && values.termMonths && values.repaymentMethod && values.startDate) {
      setPreviewData(values);
      message.info('已更新预览数据');
    } else {
      message.warning('请填写完整的债务信息以预览');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link to="/debts">
          <Button icon={<ArrowLeftOutlined />}>返回列表</Button>
        </Link>
      </div>

      <h2 style={{ marginBottom: 24 }}>
        {isEdit ? '✏️ 编辑债务' : '➕ 添加债务'}
      </h2>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card title="债务信息">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              onValuesChange={handleValuesChange}
              initialValues={{
                type: 'credit_card' as DebtType,
                repaymentMethod: 'equal_installment' as RepaymentMethod,
                startDate: dayjs(),
                dueDay: 1,
              }}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="债务名称"
                    name="name"
                    rules={[{ required: true, message: '请输入债务名称' }]}
                  >
                    <Input placeholder="例如：招商银行信用卡" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="债务类型"
                    name="type"
                    rules={[{ required: true, message: '请选择债务类型' }]}
                  >
                    <Select>
                      <Option value="credit_card">💳 信用卡</Option>
                      <Option value="mortgage">🏠 房贷</Option>
                      <Option value="car_loan">🚗 车贷</Option>
                      <Option value="personal_loan">💰 个人贷款</Option>
                      <Option value="other">📋 其他</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="本金金额 (元)"
                    name="principal"
                    rules={[
                      { required: true, message: '请输入本金金额' },
                      { type: 'number', min: 1, message: '本金必须大于0' },
                    ]}
                  >
                    <InputNumber style={{ width: '100%' }} placeholder="请输入本金" min={0} step={1000} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="年利率 (%)"
                    name="annualRate"
                    rules={[
                      { required: true, message: '请输入年利率' },
                      { type: 'number', min: 0, max: 100, message: '利率应在0-100之间' },
                    ]}
                  >
                    <InputNumber style={{ width: '100%' }} placeholder="例如：5.88" min={0} max={100} step={0.01} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="还款期限 (月)"
                    name="termMonths"
                    rules={[
                      { required: true, message: '请输入还款期限' },
                      { type: 'number', min: 1, max: 600, message: '期限应在1-600个月之间' },
                    ]}
                  >
                    <InputNumber style={{ width: '100%' }} placeholder="例如：36" min={1} max={600} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="还款方式"
                    name="repaymentMethod"
                    rules={[{ required: true, message: '请选择还款方式' }]}
                  >
                    <Select>
                      <Option value="equal_installment">等额本息</Option>
                      <Option value="equal_principal">等额本金</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="开始日期"
                    name="startDate"
                    rules={[{ required: true, message: '请选择开始日期' }]}
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="还款日 (每月)"
                    name="dueDay"
                    rules={[
                      { required: true, message: '请选择还款日' },
                      { type: 'number', min: 1, max: 31, message: '还款日应在1-31之间' },
                    ]}
                  >
                    <InputNumber style={{ width: '100%' }} min={1} max={31} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="备注" name="note">
                <TextArea rows={3} placeholder="可选：填写其他备注信息" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                    {isEdit ? '更新债务' : '添加债务'}
                  </Button>
                  <Button icon={<CalculatorOutlined />} onClick={handlePreview}>
                    预览计算
                  </Button>
                  <Link to="/debts">
                    <Button>取消</Button>
                  </Link>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="📊 还款预览" style={{ position: 'sticky', top: 24 }}>
            {previewData ? (
              <PreviewCalculation data={previewData} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-text">填写表单后自动预览还款计划</div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function PreviewCalculation({ data }: { data: FormData }) {
  const debt = {
    id: 'preview',
    name: data.name,
    type: data.type,
    principal: data.principal,
    annualRate: data.annualRate,
    termMonths: data.termMonths,
    repaymentMethod: data.repaymentMethod,
    startDate: data.startDate.format('YYYY-MM-DD'),
    dueDay: data.dueDay,
    createdAt: '',
    updatedAt: '',
  };

  const calc = generateRepaymentSchedule(debt);
  const years = Math.floor(data.termMonths / 12);
  const months = data.termMonths % 12;

  return (
    <div>
      <div style={{ marginBottom: 16, padding: 12, background: '#f0f5ff', borderRadius: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
          {DebtTypeLabels[data.type]} - {data.name}
        </div>
        <div style={{ color: '#666' }}>
          {RepaymentMethodLabels[data.repaymentMethod]} | {years > 0 ? `${years}年` : ''}{months > 0 ? `${months}个月` : ''}
        </div>
      </div>

      <Row gutter={[8, 8]}>
        <Col xs={12}>
          <Card size="small" className="stat-card">
            <Statistic
              title="月供"
              value={calc.monthlyPayment}
              precision={2}
              prefix="¥"
              valueStyle={{ fontSize: 16, color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={12}>
          <Card size="small" className="stat-card">
            <Statistic
              title="总还款"
              value={calc.totalPayment}
              precision={2}
              prefix="¥"
              valueStyle={{ fontSize: 16, color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12}>
          <Card size="small" className="stat-card">
            <Statistic
              title="总利息"
              value={calc.totalInterest}
              precision={2}
              prefix="¥"
              valueStyle={{ fontSize: 16, color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12}>
          <Card size="small" className="stat-card">
            <Statistic
              title="本金"
              value={data.principal}
              precision={2}
              prefix="¥"
              valueStyle={{ fontSize: 16, color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 16, padding: 12, background: '#fffbe6', borderRadius: 8 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>💡 利率成本分析</div>
        <div style={{ color: '#666', fontSize: 13 }}>
          利息占本金的 <span style={{ color: '#cf1322', fontWeight: 'bold' }}>
            {((calc.totalInterest / data.principal) * 100).toFixed(1)}%
          </span>
        </div>
        <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
          实际年利率 <span style={{ fontWeight: 'bold' }}>{data.annualRate}%</span>
        </div>
      </div>

      {calc.totalInterest / data.principal > 0.3 && (
        <div style={{ marginTop: 12, padding: 12, background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 8 }}>
          <div style={{ color: '#cf1322', fontWeight: 'bold' }}>⚠️ 高利息提醒</div>
          <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
            利息支出较高，建议考虑提前还款或优化还款策略
          </div>
        </div>
      )}
    </div>
  );
}
