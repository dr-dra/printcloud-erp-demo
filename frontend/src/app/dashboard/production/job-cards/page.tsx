'use client';

import { Card, Button, Table, Badge, Progress } from 'flowbite-react';
import { HiPlus, HiEye, HiPencil, HiPlay, HiPause } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';

export default function JobCardsPage() {
  // Sample job cards data
  const jobCards = [
    {
      id: 'JOB-001',
      orderRef: 'ORD-001',
      customer: 'ABC Printing Co.',
      item: '500 Business Cards',
      status: 'In Progress',
      progress: 75,
      stage: 'Press',
      assignedTo: 'John Doe',
      dueDate: '2025-06-12',
    },
    {
      id: 'JOB-002',
      orderRef: 'ORD-002',
      customer: 'Design Studio Ltd.',
      item: '1000 Flyers',
      status: 'Completed',
      progress: 100,
      stage: 'Post-Press',
      assignedTo: 'Jane Smith',
      dueDate: '2025-06-10',
    },
    {
      id: 'JOB-003',
      orderRef: 'ORD-003',
      customer: 'Marketing Agency',
      item: '200 Posters',
      status: 'Queued',
      progress: 25,
      stage: 'Pre-Press',
      assignedTo: 'Mike Johnson',
      dueDate: '2025-06-15',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'success';
      case 'In Progress':
        return 'warning';
      case 'Queued':
        return 'gray';
      case 'On Hold':
        return 'failure';
      default:
        return 'gray';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Job Cards</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage production jobs and track progress
            </p>
          </div>
          <Button>
            <HiPlus className="mr-2 h-4 w-4" />
            Create Job Card
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">15</h3>
            <p className="text-gray-600 dark:text-gray-400">Active Jobs</p>
          </Card>
          <Card className="text-center">
            <h3 className="text-2xl font-bold text-yellow-600">8</h3>
            <p className="text-gray-600 dark:text-gray-400">In Progress</p>
          </Card>
          <Card className="text-center">
            <h3 className="text-2xl font-bold text-gray-600">4</h3>
            <p className="text-gray-600 dark:text-gray-400">Queued</p>
          </Card>
          <Card className="text-center">
            <h3 className="text-2xl font-bold text-green-600">12</h3>
            <p className="text-gray-600 dark:text-gray-400">Completed Today</p>
          </Card>
        </div>

        {/* Job Cards Table */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Production Jobs</h2>
          </div>

          <div className="overflow-x-auto">
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell>Job ID</Table.HeadCell>
                <Table.HeadCell>Order Ref</Table.HeadCell>
                <Table.HeadCell>Customer</Table.HeadCell>
                <Table.HeadCell>Item</Table.HeadCell>
                <Table.HeadCell>Stage</Table.HeadCell>
                <Table.HeadCell>Progress</Table.HeadCell>
                <Table.HeadCell>Assigned To</Table.HeadCell>
                <Table.HeadCell>Due Date</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell>Actions</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {jobCards.map((job) => (
                  <Table.Row
                    key={job.id}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      {job.id}
                    </Table.Cell>
                    <Table.Cell className="font-medium text-blue-600 dark:text-blue-400">
                      {job.orderRef}
                    </Table.Cell>
                    <Table.Cell>{job.customer}</Table.Cell>
                    <Table.Cell>{job.item}</Table.Cell>
                    <Table.Cell>
                      <Badge color="info">{job.stage}</Badge>
                    </Table.Cell>
                    <Table.Cell className="w-32">
                      <div className="space-y-1">
                        <Progress
                          progress={job.progress}
                          size="sm"
                          color={
                            job.progress === 100 ? 'green' : job.progress > 50 ? 'yellow' : 'blue'
                          }
                        />
                        <span className="text-xs text-gray-500">{job.progress}%</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{job.assignedTo}</Table.Cell>
                    <Table.Cell>{job.dueDate}</Table.Cell>
                    <Table.Cell>
                      <Badge color={getStatusColor(job.status)}>{job.status}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex space-x-2">
                        <Button size="xs" color="gray" title="View Details">
                          <HiEye className="h-3 w-3" />
                        </Button>
                        <Button size="xs" color="gray" title="Edit">
                          <HiPencil className="h-3 w-3" />
                        </Button>
                        {job.status === 'In Progress' ? (
                          <Button size="xs" color="warning" title="Pause">
                            <HiPause className="h-3 w-3" />
                          </Button>
                        ) : (
                          <Button size="xs" color="green" title="Start">
                            <HiPlay className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
