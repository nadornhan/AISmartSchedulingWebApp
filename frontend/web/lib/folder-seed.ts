import type { TasksByFolder } from '../components/folders/folder-list';
import type { InboxTask } from '../components/folders/inbox-list';
import type { Folder } from './folders';

const seedDate = '2026-07-27T00:00:00.000Z';
const seedUserId = '00000000-0000-4000-8000-000000000001';

export const seedFolders: Folder[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    user_id: seedUserId,
    name: 'Work',
    color: '#FF5757',
    task_count: 6,
    completed_task_count: 4,
    created_at: seedDate,
    updated_at: seedDate,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    user_id: seedUserId,
    name: 'Personal',
    color: '#3B82F6',
    task_count: 5,
    completed_task_count: 1,
    created_at: seedDate,
    updated_at: seedDate,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    user_id: seedUserId,
    name: 'Study',
    color: '#FFD21F',
    task_count: 3,
    completed_task_count: 1,
    created_at: seedDate,
    updated_at: seedDate,
  },
];

export const seedTasksByFolder: TasksByFolder = {
  '10000000-0000-4000-8000-000000000001': [
    {
      id: '20000000-0000-4000-8000-000000000001',
      title: 'Prepare Q2 Report',
      status: 'pending',
      priority: 'high',
    },
    {
      id: '20000000-0000-4000-8000-000000000002',
      title: 'Review PR #47',
      status: 'pending',
      priority: 'medium',
    },
    {
      id: '20000000-0000-4000-8000-000000000003',
      title: 'Standup meeting',
      status: 'pending',
      priority: 'low',
    },
  ],
  '10000000-0000-4000-8000-000000000002': [
    {
      id: '20000000-0000-4000-8000-000000000004',
      title: 'Buy groceries',
      status: 'pending',
      priority: 'low',
    },
    {
      id: '20000000-0000-4000-8000-000000000005',
      title: 'Call dentist',
      status: 'pending',
      priority: 'medium',
    },
    {
      id: '20000000-0000-4000-8000-000000000006',
      title: 'Plan weekend trip',
      status: 'pending',
      priority: 'low',
    },
  ],
  '10000000-0000-4000-8000-000000000003': [
    {
      id: '20000000-0000-4000-8000-000000000007',
      title: 'CST321 Use Cases',
      status: 'pending',
      priority: 'high',
    },
    {
      id: '20000000-0000-4000-8000-000000000008',
      title: 'Read Chapter 4',
      status: 'pending',
      priority: 'medium',
    },
    {
      id: '20000000-0000-4000-8000-000000000009',
      title: 'Practice problems',
      status: 'pending',
      priority: 'low',
    },
  ],
};

export const seedInboxTasks: InboxTask[] = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    title: 'Look up gym memberships',
    status: 'pending',
    priority: 'no_priority',
    icon: 'calendar',
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    title: 'Research vacation destinations',
    status: 'pending',
    priority: 'no_priority',
    icon: 'search',
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    title: 'Fix bathroom tap',
    status: 'pending',
    priority: 'no_priority',
    icon: 'tool',
  },
];
