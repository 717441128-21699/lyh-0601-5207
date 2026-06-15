import { useEffect, useState } from 'react';
import { Select, Table, Card, Button, Modal, Form, Input, InputNumber, DatePicker, Upload, message, Space, Tag, Popconfirm, Image, Row, Col } from 'antd';
import { PlusOutlined, UploadOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useDebtStore } from '../store/useDebtStore';
import { RepaymentRecord } from '../types';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

export default function Repayments() {
  const { debts, repaymentRecords, fetchDebts, fetchRepaymentRecords, createRepaymentRecord, verifyRepayment, deleteRepaymentRecord, loading } = useDebtStore();
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<any[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  useEffect(() => {
    if (selectedDebtId) {
      fetchRepaymentRecords(selectedDebtId);
    }
  }, [selectedDebtId, fetchRepaymentRecords]);

  const handleSubmit = async (values: any) => {
    if (!selectedDebtId) return;

    const formData = new FormData();
    formData.append('debtId', selectedDebtId);
    formData.append('period', values.period.toString());
    formData.append('amount', values.amount.toString());
    formData.append('extraPayment', (values.extraPayment || 0).toString());
    formData.append('paymentDate', values.paymentDate.format('YYYY-MM-DD'));
    if (values.note) {
      formData.append('note', values.note);
    }
    if (fileList.length > 0 && fileList[0].originFileObj) {
      formData.append('voucher', fileList[0].originFileObj);
    }

    const success = await createRepaymentRecord(formData);
    if (success) {
      message.success('还款记录创建成功，凭证已自动验证');
      setModalVisible(false);
      form.resetFields();
      setFileList([]);
      fetchRepaymentRecords(selectedDebtId);
    } else {
      message.error('创建失败');
    }
  };

  const handleVerify = async (id: string, verified: boolean) => {
    const success = await verifyRepayment(id, verified);
    if (success) {
      message.success(verified ? '已标记为已验证' : '已取消验证');
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteRepaymentRecord(id);
    if (success) {
      message.success('删除成功');
      if (selectedDebtId) {
        fetchRepaymentRecords(selectedDebtId);
      }
    } else {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<RepaymentRecord> = [
    {
      title: '期数',
      dataIndex: 'period',
      key: 'period',
      width: 80,
      render: (value) => <span style={{ fontWeight: 'bold' }}>第{value}期</span>,
    },
    {
      title: '还款日期',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 120,
      render: (value) => dayjs(value).format('YYYY-MM-DD'),
    },
    {
      title: '还款金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (value) => <span style={{ fontWeight: 'bold' }}>¥{value.toFixed(2)}</span>,
    },
    {
      title: '提前还款',
      dataIndex: 'extraPayment',
      key: 'extraPayment',
      width: 120,
      render: (value) =>
        value > 0 ? <Tag color="green">+¥{value.toFixed(2)}</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '凭证',
      dataIndex: 'voucherUrl',
      key: 'voucherUrl',
      width: 100,
      render: (value) =>
        value ? (
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setPreviewImage(value)}
          >
            查看
          </Button>
        ) : (
          <span style={{ color: '#999' }}>无</span>
        ),
    },
    {
      title: '状态',
      dataIndex: 'verified',
      key: 'verified',
      width: 100,
      render: (value) =>
        value ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已验证
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="warning">
            待验证
          </Tag>
        ),
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      render: (value) => value || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => handleVerify(record.id, !record.verified)}
          >
            {record.verified ? '取消验证' : '验证'}
          </Button>
          <Popconfirm title="确定删除此记录吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const uploadProps = {
    fileList,
    onChange: ({ fileList: newFileList }: any) => setFileList(newFileList),
    beforeUpload: () => false,
    maxCount: 1,
    accept: 'image/*',
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>📝 还款记录</h2>

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
                {debt.name}
              </Option>
            ))}
          </Select>
          {selectedDebtId && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              添加还款记录
            </Button>
          )}
        </Space>
      </Card>

      {selectedDebtId ? (
        <Card>
          <Table
            columns={columns}
            dataSource={repaymentRecords}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1000 }}
          />
        </Card>
      ) : (
        <Card>
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">请选择一个债务查看还款记录</div>
          </div>
        </Card>
      )}

      <Modal
        title="添加还款记录"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="还款期数"
                name="period"
                rules={[{ required: true, message: '请输入期数' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} placeholder="例如：1" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="还款日期"
                name="paymentDate"
                rules={[{ required: true, message: '请选择日期' }]}
                initialValue={dayjs()}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="还款金额 (元)"
                name="amount"
                rules={[{ required: true, message: '请输入还款金额' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="本期应还金额" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="提前还款 (元)" name="extraPayment" initialValue={0}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="额外提前还款金额" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="上传银行凭证" name="voucher">
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>选择图片</Button>
            </Upload>
          </Form.Item>
          <Form.Item label="备注" name="note">
            <TextArea rows={3} placeholder="可选：填写备注信息" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                提交
              </Button>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="银行凭证"
        open={!!previewImage}
        onCancel={() => setPreviewImage(null)}
        footer={null}
        width={600}
      >
        {previewImage && (
          <Image
            width={'100%'}
            src={previewImage.startsWith('http') ? previewImage : previewImage}
            alt="银行凭证"
          />
        )}
      </Modal>
    </div>
  );
}
