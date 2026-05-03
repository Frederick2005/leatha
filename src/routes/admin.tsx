import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ConfigProvider, theme as antdTheme, Layout, Menu, Card, Row, Col, Statistic,
  Table, Tag, Button, Space, Modal, Input, Select, Form, message, Popconfirm, Avatar, InputNumber, Switch, Typography,
} from "antd";
import {
  DashboardOutlined, UserOutlined, BookOutlined, FlagOutlined, MessageOutlined,
  TrophyOutlined, NotificationOutlined, SafetyOutlined, ArrowLeftOutlined,
} from "@ant-design/icons";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { useTheme } from "@/providers/theme-provider";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — SkillChain" }] }),
  component: () => (<RequireAuth><AdminGate /></RequireAuth>),
});

const { Sider, Content, Header } = Layout;
const { Title, Text } = Typography;

async function logAdminAction(action: string, target_type?: string, target_id?: string, details: Record<string, unknown> = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("admin_logs").insert({
    admin_id: user.id, action,
    target_type: target_type ?? null, target_id: target_id ?? null,
    details: details as never,
  });
}

function AdminGate() {
  const { isModOrAdmin, isAdmin, loading } = useAuth();
  const { darkMode } = useTheme();
  const isDark = darkMode;

  if (loading) return <div className="min-h-[60vh] grid place-items-center"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  if (!isModOrAdmin) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <SafetyOutlined style={{ fontSize: 48 }} className="text-muted-foreground" />
        <h1 className="text-2xl font-display font-semibold mt-4">Admin access only</h1>
        <p className="text-muted-foreground mt-2">You need moderator or admin role to view this page.</p>
        <Link to="/" className="text-primary underline mt-4 inline-block">Back to feed</Link>
      </div>
    );
  }
  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { colorPrimary: "#3b82f6", borderRadius: 8 },
      }}
    >
      <AdminApp isAdmin={isAdmin} />
    </ConfigProvider>
  );
}

type Section = "dashboard" | "users" | "lessons" | "reports" | "feedback" | "rewards" | "announcements" | "logs";

function AdminApp({ isAdmin }: { isAdmin: boolean }) {
  const [section, setSection] = useState<Section>("dashboard");

  return (
    <Layout style={{ minHeight: "calc(100vh - 64px)", background: "transparent" }}>
      <Sider width={220} theme="light" style={{ background: "var(--surface)" }} breakpoint="lg" collapsedWidth={0}>
        <div className="p-4">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeftOutlined /> Back to app
          </Link>
          <Title level={4} style={{ margin: "12px 0 0" }}>SkillChain Admin</Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[section]}
          style={{ background: "transparent", borderRight: 0 }}
          onClick={(e) => setSection(e.key as Section)}
          items={[
            { key: "dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
            { key: "users", icon: <UserOutlined />, label: "Users" },
            { key: "lessons", icon: <BookOutlined />, label: "Lessons" },
            { key: "reports", icon: <FlagOutlined />, label: "Reports" },
            { key: "feedback", icon: <MessageOutlined />, label: "Feedback" },
            { key: "rewards", icon: <TrophyOutlined />, label: "Rewards" },
            { key: "announcements", icon: <NotificationOutlined />, label: "Announcements" },
            { key: "logs", icon: <SafetyOutlined />, label: "Audit Logs" },
          ]}
        />
      </Sider>
      <Layout style={{ background: "transparent" }}>
        <Content style={{ padding: 24 }}>
          {section === "dashboard" && <DashboardPanel />}
          {section === "users" && <UsersPanel isAdmin={isAdmin} />}
          {section === "lessons" && <LessonsPanel />}
          {section === "reports" && <ReportsPanel />}
          {section === "feedback" && <FeedbackPanel />}
          {section === "rewards" && <RewardsPanel isAdmin={isAdmin} />}
          {section === "announcements" && <AnnouncementsPanel isAdmin={isAdmin} />}
          {section === "logs" && <LogsPanel />}
        </Content>
      </Layout>
    </Layout>
  );
}

// ─────────────── Dashboard ───────────────
function DashboardPanel() {
  const [stats, setStats] = useState({ users: 0, lessons: 0, reports: 0, feedback: 0 });
  const [activity, setActivity] = useState<{ date: string; lessons: number; users: number }[]>([]);

  useEffect(() => {
    void (async () => {
      const [u, l, r, f] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("lessons").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      setStats({ users: u.count ?? 0, lessons: l.count ?? 0, reports: r.count ?? 0, feedback: f.count ?? 0 });

      const since = new Date(); since.setDate(since.getDate() - 14);
      const [{ data: ls }, { data: ps }] = await Promise.all([
        supabase.from("lessons").select("created_at").gte("created_at", since.toISOString()),
        supabase.from("profiles").select("created_at").gte("created_at", since.toISOString()),
      ]);
      const days: Record<string, { lessons: number; users: number }> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const k = d.toISOString().slice(5, 10);
        days[k] = { lessons: 0, users: 0 };
      }
      (ls ?? []).forEach((x: { created_at: string }) => { const k = x.created_at.slice(5, 10); if (days[k]) days[k].lessons++; });
      (ps ?? []).forEach((x: { created_at: string }) => { const k = x.created_at.slice(5, 10); if (days[k]) days[k].users++; });
      setActivity(Object.entries(days).map(([date, v]) => ({ date, ...v })));
    })();
  }, []);

  return (
    <div>
      <Title level={3}>Overview</Title>
      <Row gutter={16}>
        <Col xs={12} md={6}><Card><Statistic title="Users" value={stats.users} prefix={<UserOutlined />} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Lessons" value={stats.lessons} prefix={<BookOutlined />} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Open Reports" value={stats.reports} prefix={<FlagOutlined />} valueStyle={{ color: stats.reports > 0 ? "#f59e0b" : undefined }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Open Feedback" value={stats.feedback} prefix={<MessageOutlined />} /></Card></Col>
      </Row>
      <Card style={{ marginTop: 16 }} title="Activity (last 14 days)">
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <AreaChart data={activity}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" /><YAxis allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="lessons" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              <Area type="monotone" dataKey="users" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

// ─────────────── Users ───────────────
interface UserRow {
  id: string; username: string; display_name: string | null; avatar_url: string | null;
  account_type: string; points: number; lesson_count: number; created_at: string;
  roles: string[];
}

function UsersPanel({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles")
      .select("id, username, display_name, avatar_url, account_type, points, lesson_count, created_at")
      .order("created_at", { ascending: false }).limit(500);
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const byUser: Record<string, string[]> = {};
    (roles ?? []).forEach((r) => { (byUser[r.user_id] = byUser[r.user_id] || []).push(r.role); });
    setRows((profiles ?? []).map((p) => ({ ...p, roles: byUser[p.id] || ["user"] })));
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const toggleRole = async (userId: string, role: "moderator" | "admin", has: boolean) => {
    if (has) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      await logAdminAction("revoke_role", "user", userId, { role });
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role });
      await logAdminAction("grant_role", "user", userId, { role });
    }
    void load();
    message.success("Updated");
  };

  const filtered = rows.filter((r) =>
    !search || r.username.toLowerCase().includes(search.toLowerCase()) ||
    (r.display_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card title="Users" extra={<Input.Search placeholder="Search…" allowClear style={{ width: 240 }} onChange={(e) => setSearch(e.target.value)} />}>
      <Table
        rowKey="id" loading={loading} dataSource={filtered} size="small" scroll={{ x: 800 }}
        pagination={{ pageSize: 20 }}
        columns={[
          { title: "User", render: (_, r) => (
            <Space><Avatar src={r.avatar_url} icon={<UserOutlined />} />
              <div><div>{r.display_name ?? r.username}</div><Text type="secondary" style={{ fontSize: 12 }}>@{r.username}</Text></div>
            </Space>
          )},
          { title: "Type", dataIndex: "account_type", render: (v) => <Tag>{v}</Tag> },
          { title: "Roles", dataIndex: "roles", render: (rs: string[]) => rs.map((r) => <Tag key={r} color={r === "admin" ? "red" : r === "moderator" ? "blue" : undefined}>{r}</Tag>) },
          { title: "Points", dataIndex: "points", sorter: (a, b) => a.points - b.points },
          { title: "Lessons", dataIndex: "lesson_count" },
          { title: "Joined", dataIndex: "created_at", render: (v) => new Date(v).toLocaleDateString() },
          isAdmin ? {
            title: "Actions",
            render: (_, r) => (
              <Space size="small">
                <Button size="small" onClick={() => toggleRole(r.id, "moderator", r.roles.includes("moderator"))}>
                  {r.roles.includes("moderator") ? "Unset Mod" : "Make Mod"}
                </Button>
                <Button size="small" danger={r.roles.includes("admin")} onClick={() => toggleRole(r.id, "admin", r.roles.includes("admin"))}>
                  {r.roles.includes("admin") ? "Revoke Admin" : "Make Admin"}
                </Button>
              </Space>
            ),
          } : { title: "", render: () => null },
        ]}
      />
    </Card>
  );
}

// ─────────────── Lessons ───────────────
interface LessonRow {
  id: string; title: string; slug: string; author_id: string; like_count: number;
  comment_count: number; fork_count: number; is_published: boolean; created_at: string; content_type?: string;
}

function LessonsPanel() {
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("lessons")
      .select("id, title, slug, author_id, like_count, comment_count, fork_count, is_published, created_at, content_type")
      .order("created_at", { ascending: false }).limit(500);
    setRows((data ?? []) as LessonRow[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) { message.error(error.message); return; }
    await logAdminAction("delete_lesson", "lesson", id);
    message.success("Lesson deleted"); void load();
  };

  const togglePublished = async (r: LessonRow) => {
    const { error } = await supabase.from("lessons").update({ is_published: !r.is_published }).eq("id", r.id);
    if (error) { message.error(error.message); return; }
    await logAdminAction(r.is_published ? "unpublish_lesson" : "publish_lesson", "lesson", r.id);
    void load();
  };

  const filtered = rows.filter((r) => !search || r.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card title="Lessons" extra={<Input.Search placeholder="Search…" allowClear style={{ width: 240 }} onChange={(e) => setSearch(e.target.value)} />}>
      <Table
        rowKey="id" loading={loading} dataSource={filtered} size="small" scroll={{ x: 900 }} pagination={{ pageSize: 20 }}
        columns={[
          { title: "Title", render: (_, r) => <Link to="/lessons/$lessonId" params={{ lessonId: r.id }} className="text-primary hover:underline">{r.title}</Link> },
          { title: "Type", dataIndex: "content_type", render: (v) => <Tag>{v ?? "text"}</Tag> },
          { title: "❤ Likes", dataIndex: "like_count", sorter: (a, b) => a.like_count - b.like_count },
          { title: "💬 Comments", dataIndex: "comment_count" },
          { title: "🍴 Forks", dataIndex: "fork_count" },
          { title: "Published", dataIndex: "is_published", render: (v, r) => <Switch checked={v} onChange={() => togglePublished(r)} size="small" /> },
          { title: "Created", dataIndex: "created_at", render: (v) => new Date(v).toLocaleDateString() },
          { title: "Actions", render: (_, r) => (
            <Popconfirm title="Delete this lesson?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger>Delete</Button>
            </Popconfirm>
          )},
        ]}
      />
    </Card>
  );
}

// ─────────────── Reports ───────────────
function ReportsPanel() {
  const [rows, setRows] = useState<{ id: string; reason: string; status: string; target_type: string; target_id: string; created_at: string; reported_by: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(200);
    setRows((data ?? []) as never);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const resolve = async (id: string, action: "resolve" | "dismiss") => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("reports").update({
      status: action === "resolve" ? "resolved" : "dismissed",
      resolved_by: user?.id ?? null,
    }).eq("id", id);
    await logAdminAction(`report_${action}`, "report", id);
    message.success("Report updated"); void load();
  };

  const removeContent = async (r: { id: string; target_type: string; target_id: string }) => {
    if (r.target_type === "lesson") await supabase.from("lessons").delete().eq("id", r.target_id);
    if (r.target_type === "comment") await supabase.from("comments").delete().eq("id", r.target_id);
    await logAdminAction("remove_content", r.target_type, r.target_id);
    await resolve(r.id, "resolve");
  };

  return (
    <Card title="Reports">
      <Table
        rowKey="id" loading={loading} dataSource={rows} size="small" scroll={{ x: 800 }} pagination={{ pageSize: 20 }}
        columns={[
          { title: "Status", dataIndex: "status", render: (v) => <Tag color={v === "pending" ? "orange" : v === "resolved" ? "green" : "default"}>{v}</Tag>,
            filters: [{ text: "pending", value: "pending" }, { text: "resolved", value: "resolved" }, { text: "dismissed", value: "dismissed" }],
            onFilter: (val, r) => r.status === val,
          },
          { title: "Target", dataIndex: "target_type" },
          { title: "Reason", dataIndex: "reason", ellipsis: true },
          { title: "Date", dataIndex: "created_at", render: (v) => new Date(v).toLocaleDateString() },
          { title: "Actions", render: (_, r) => (
            <Space size="small">
              {r.status === "pending" && <>
                <Popconfirm title="Remove the reported content?" onConfirm={() => removeContent(r)}>
                  <Button size="small" danger>Remove & Resolve</Button>
                </Popconfirm>
                <Button size="small" onClick={() => resolve(r.id, "dismiss")}>Dismiss</Button>
              </>}
              {r.target_type === "lesson" && <Link to="/lessons/$lessonId" params={{ lessonId: r.target_id }}><Button size="small" type="link">View</Button></Link>}
            </Space>
          )},
        ]}
      />
    </Card>
  );
}

// ─────────────── Feedback ───────────────
function FeedbackPanel() {
  const [rows, setRows] = useState<{ id: string; subject: string; body: string; category: string; status: string; rating: number | null; priority: boolean; created_at: string; admin_notes: string | null; response: string | null; user_id: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<typeof rows[number] | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(300);
    setRows((data ?? []) as never);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const update = async (id: string, patch: Record<string, unknown>) => {
    await supabase.from("feedback").update(patch as never).eq("id", id);
    await logAdminAction("feedback_update", "feedback", id, patch);
    void load();
  };

  return (
    <Card title="Feedback">
      <Table
        rowKey="id" loading={loading} dataSource={rows} size="small" scroll={{ x: 900 }} pagination={{ pageSize: 20 }}
        columns={[
          { title: "Status", dataIndex: "status", render: (v) => <Tag color={v === "open" ? "blue" : v === "in_review" ? "gold" : v === "resolved" ? "green" : "default"}>{v}</Tag> },
          { title: "Category", dataIndex: "category", render: (v) => <Tag>{v}</Tag> },
          { title: "Subject", dataIndex: "subject", ellipsis: true },
          { title: "Rating", dataIndex: "rating", render: (v) => v ? "⭐".repeat(v) : "—" },
          { title: "Priority", dataIndex: "priority", render: (v) => v ? <Tag color="red">High</Tag> : "—" },
          { title: "Date", dataIndex: "created_at", render: (v) => new Date(v).toLocaleDateString() },
          { title: "Actions", render: (_, r) => <Button size="small" onClick={() => setOpen(r)}>Manage</Button> },
        ]}
      />
      <Modal
        open={!!open} title={open?.subject} onCancel={() => setOpen(null)} footer={null} width={680} destroyOnClose
      >
        {open && (
          <FeedbackForm
            row={open}
            onSave={async (patch) => { await update(open.id, patch); setOpen(null); message.success("Saved"); }}
          />
        )}
      </Modal>
    </Card>
  );
}

function FeedbackForm({ row, onSave }: { row: { body: string; status: string; priority: boolean; admin_notes: string | null; response: string | null }; onSave: (p: Record<string, unknown>) => void }) {
  const [form] = Form.useForm();
  return (
    <Form form={form} layout="vertical" initialValues={row} onFinish={onSave}>
      <Card size="small" style={{ marginBottom: 16 }}><Text>{row.body}</Text></Card>
      <Form.Item name="status" label="Status"><Select options={[{ value: "open", label: "Open" }, { value: "in_review", label: "In Review" }, { value: "resolved", label: "Resolved" }, { value: "dismissed", label: "Dismissed" }]} /></Form.Item>
      <Form.Item name="priority" label="Priority" valuePropName="checked"><Switch /></Form.Item>
      <Form.Item name="admin_notes" label="Internal Notes"><Input.TextArea rows={3} /></Form.Item>
      <Form.Item name="response" label="Response to user"><Input.TextArea rows={3} /></Form.Item>
      <Button type="primary" htmlType="submit">Save</Button>
    </Form>
  );
}

// ─────────────── Rewards ───────────────
function RewardsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = useState<{ id: string; username: string; display_name: string | null; points: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("id, username, display_name, points").order("points", { ascending: false }).limit(200);
    setRows((data ?? []) as never);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const adjust = async (id: string, points: number) => {
    await supabase.from("profiles").update({ points }).eq("id", id);
    await logAdminAction("adjust_points", "user", id, { points });
    message.success("Updated"); void load();
  };

  return (
    <Card title="Rewards / Points Leaderboard">
      <Table
        rowKey="id" loading={loading} dataSource={rows} size="small" pagination={{ pageSize: 20 }}
        columns={[
          { title: "#", render: (_, __, i) => i + 1, width: 60 },
          { title: "User", render: (_, r) => <span>{r.display_name ?? r.username} <Text type="secondary">@{r.username}</Text></span> },
          { title: "Points", dataIndex: "points",
            render: (v, r) => isAdmin
              ? <InputNumber min={0} defaultValue={v} onBlur={(e) => { const n = Number(e.target.value); if (n !== v) void adjust(r.id, n); }} />
              : v
          },
        ]}
      />
    </Card>
  );
}

// ─────────────── Announcements ───────────────
function AnnouncementsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = useState<{ id: string; title: string; body: string; audience: string; created_at: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(100);
    setRows((data ?? []) as never);
  };
  useEffect(() => { void load(); }, []);

  const submit = async (vals: { title: string; body: string; audience: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("announcements").insert({ ...vals, author_id: user.id });
    if (error) { message.error(error.message); return; }
    await logAdminAction("create_announcement", "announcement", undefined, vals);
    message.success("Posted"); setOpen(false); form.resetFields(); void load();
  };

  const remove = async (id: string) => {
    await supabase.from("announcements").delete().eq("id", id);
    await logAdminAction("delete_announcement", "announcement", id);
    void load();
  };

  return (
    <Card title="Announcements" extra={isAdmin && <Button type="primary" onClick={() => setOpen(true)}>New</Button>}>
      <Table
        rowKey="id" dataSource={rows} size="small" pagination={{ pageSize: 20 }}
        columns={[
          { title: "Title", dataIndex: "title" },
          { title: "Audience", dataIndex: "audience", render: (v) => <Tag>{v}</Tag> },
          { title: "Date", dataIndex: "created_at", render: (v) => new Date(v).toLocaleDateString() },
          { title: "Body", dataIndex: "body", ellipsis: true },
          isAdmin ? { title: "", render: (_, r) => <Popconfirm title="Delete?" onConfirm={() => remove(r.id)}><Button size="small" danger>Delete</Button></Popconfirm> } : { title: "", render: () => null },
        ]}
      />
      <Modal open={open} title="New Announcement" onCancel={() => setOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={submit} initialValues={{ audience: "all" }}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="audience" label="Audience"><Select options={[{ value: "all", label: "Everyone" }, { value: "student", label: "Students" }, { value: "teacher", label: "Teachers" }]} /></Form.Item>
          <Form.Item name="body" label="Body" rules={[{ required: true }]}><Input.TextArea rows={5} /></Form.Item>
          <Button type="primary" htmlType="submit">Post</Button>
        </Form>
      </Modal>
    </Card>
  );
}

// ─────────────── Logs ───────────────
function LogsPanel() {
  const [rows, setRows] = useState<{ id: string; admin_id: string; action: string; target_type: string | null; target_id: string | null; created_at: string }[]>([]);
  useEffect(() => {
    void supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setRows((data ?? []) as never));
  }, []);
  return (
    <Card title="Audit Logs">
      <Table
        rowKey="id" dataSource={rows} size="small" pagination={{ pageSize: 20 }} scroll={{ x: 700 }}
        columns={[
          { title: "When", dataIndex: "created_at", render: (v) => new Date(v).toLocaleString() },
          { title: "Action", dataIndex: "action", render: (v) => <Tag>{v}</Tag> },
          { title: "Target", render: (_, r) => r.target_type ? `${r.target_type}:${r.target_id?.slice(0, 8)}` : "—" },
          { title: "Admin", dataIndex: "admin_id", render: (v: string) => <Text code style={{ fontSize: 11 }}>{v?.slice(0, 8)}</Text> },
        ]}
      />
    </Card>
  );
}
