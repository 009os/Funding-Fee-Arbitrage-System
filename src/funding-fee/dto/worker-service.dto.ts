import { JobStatus } from '@prisma/client';

export interface UdpateJobInDb {
  jobId: string;
  processedQuantity: number;
  jobStatus: JobStatus;
}
