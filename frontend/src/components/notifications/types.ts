export interface User {
  id: number;
  email: string;
  username: string | null;
  full_name: string;
}

export interface Reminder {
  id: number;
  entity_type: 'quotation' | 'job_ticket' | 'customer' | 'order' | 'invoice';
  entity_id: number;
  entity_ref: string;
  assignee_user: User;
  due_at: string;
  note: string;
  status: 'pending' | 'sent' | 'snoozed' | 'done' | 'canceled';
  origin_module: string;
  auto_cancel_on_states: string[];
  created_by: User;
  created_at: string;
  updated_at: string;
  link_path: string;
  is_overdue: boolean;
  is_due_today: boolean;
}

export interface Notification {
  id: number;
  reminder: Reminder;
  channel: 'in_app' | 'email_digest';
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  is_unread: boolean;
  time_since_created: string;
}

export interface NotificationResponse {
  unread_count: number;
  notifications: Notification[];
}

export interface ReminderCreateData {
  entity_type: Reminder['entity_type'];
  entity_id: number;
  entity_ref: string;
  assignee_user: number;
  due_at: string;
  note?: string;
  origin_module?: string;
  auto_cancel_on_states?: string[];
  link_path?: string;
}
