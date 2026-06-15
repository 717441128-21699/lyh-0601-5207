import { useEffect, useState } from 'react';
import { Card, Form, Switch, InputNumber, Select, Button, List, Tag, message, Space, Divider, Row, Col } from 'antd';
import { BellOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useDebtStore } from '../store/useDebtStore';
import { ReminderSettings } from '../types';
import dayjs from 'dayjs';

const { Option } = Select;

export default function Reminders() {
  const { reminderSettings, upcomingPayments, fetchReminderSettings, fetchUpcomingPayments, updateGlobalReminder, loading } = useDebtStore();
  const [form] = Form.useForm();

  useEffect(() => {
    fetchReminderSettings();
    fetchUpcomingPayments(30);
  }, [fetchReminderSettings, fetchUpcomingPayments]);

  const globalSetting = reminderSettings.find((s) => !s.debtId);

  const handleSave = async (values: any) => {
    const success = await updateGlobalReminder({
      enabled: values.enabled,
      daysBefore: values.daysBefore,
      notificationType: values.notificationType,
    });
    if (success) {
      message.success('设置保存成功');
      fetchUpcomingPayments(30);
    } else {
      message.error('保存失败');
    }
  };

  useEffect(() => {
    if (globalSetting) {
      form.setFieldsValue({
        enabled: globalSetting.enabled,
        daysBefore: globalSetting.daysBefore,
        notificationType: globalSetting.notificationType,
      });
    }
  }, [globalSetting, form]);

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>🔔 还款提醒设置</h2>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="⚙️ 全局提醒设置">
            <Form form={form} layout="vertical" onFinish={handleSave}>
              <Form.Item label="启用还款提醒" name="enabled" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item
                label="提前提醒天数"
                name="daysBefore"
                rules={[{ required: true, message: '请输入提前天数' }]}
              >
                <InputNumber min={1} max={30} style={{ width: '100%' }} suffix="天" />
              </Form.Item>
              <Form.Item
                label="通知方式"
                name="notificationType"
                rules={[{ required: true, message: '请选择通知方式' }]}
              >
                <Select>
                  <Option value="push">推送通知</Option>
                  <Option value="email">邮件通知</Option>
                  <Option value="both">推送 + 邮件</Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  保存设置
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Card title="💡 温馨提示" style={{ marginTop: 24 }}>
            <List
              size="small"
              dataSource={[
                '系统会根据您设置的提前天数，在还款日前自动提醒您',
                '建议设置至少3天的提前提醒，以确保有足够时间处理还款',
                '开启通知权限后，您将收到浏览器推送通知',
                '您可以为每笔债务单独设置提醒规则',
                '及时还款可以避免逾期费用，保护您的信用记录',
              ]}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta title={item} />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <BellOutlined style={{ marginRight: 8 }} />
                即将到期的还款 ({upcomingPayments.length})
              </span>
            }
            extra={
              <Button size="small" onClick={() => fetchUpcomingPayments(30)}>
                刷新
              </Button>
            }
          >
            {upcomingPayments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🎉</div>
                <div className="empty-state-text">近期没有需要还款的债务</div>
              </div>
            ) : (
              <List
                dataSource={upcomingPayments}
                renderItem={(item) => (
                  <List.Item
                    className={item.daysRemaining <= 3 ? 'upcoming-payment urgent' : 'upcoming-payment'}
                    style={{ marginBottom: 12 }}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <span style={{ fontWeight: 'bold' }}>{item.debtName}</span>
                          {item.daysRemaining <= 3 && (
                            <Tag color="red">紧急</Tag>
                          )}
                          {item.daysRemaining > 3 && item.daysRemaining <= 7 && (
                            <Tag color="orange">即将到期</Tag>
                          )}
                        </Space>
                      }
                      description={
                        <span style={{ color: '#666' }}>
                          还款日: {dayjs(item.dueDate).format('YYYY-MM-DD')}
                        </span>
                      }
                    />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 'bold', color: '#cf1322' }}>
                        ¥{item.amount.toFixed(2)}
                      </div>
                      <Space>
                        {item.daysRemaining === 0 && (
                          <Tag icon={<ClockCircleOutlined />} color="red">今天到期</Tag>
                        )}
                        {item.daysRemaining > 0 && (
                          <Tag color={item.daysRemaining <= 3 ? 'red' : 'orange'}>
                            {item.daysRemaining}天后
                          </Tag>
                        )}
                        {item.daysRemaining < 0 && (
                          <Tag icon={<ClockCircleOutlined />} color="red">已逾期{Math.abs(item.daysRemaining)}天</Tag>
                        )}
                      </Space>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>

          {globalSetting?.enabled && upcomingPayments.length > 0 && (
            <Card
              title="📊 本月还款概览"
              style={{ marginTop: 24 }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={12}>
                  <div style={{ textAlign: 'center', padding: 16 }}>
                    <div style={{ color: '#666', marginBottom: 8 }}>待还笔数</div>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1890ff' }}>
                      {upcomingPayments.filter(p => p.daysRemaining >= 0).length}
                    </div>
                  </div>
                </Col>
                <Col xs={12}>
                  <div style={{ textAlign: 'center', padding: 16 }}>
                    <div style={{ color: '#666', marginBottom: 8 }}>待还总额</div>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#cf1322' }}>
                      ¥{upcomingPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(0)}
                    </div>
                  </div>
                </Col>
              </Row>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ textAlign: 'center', color: '#666', fontSize: 13 }}>
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                提醒已开启，将在还款日前 {globalSetting.daysBefore} 天提醒您
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
