import { ReportsData } from '../../../hooks/useReportsData';
import { ReportFilters } from '../../../lib/reportsApi';

export interface SectionProps {
  data: ReportsData;
  filters: ReportFilters;
  rangeLabel: string;
}
