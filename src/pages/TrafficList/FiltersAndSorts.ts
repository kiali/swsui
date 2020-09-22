import { FilterType } from '../../types/Filters';
import { SortField } from '../../types/SortFilters';
import { TrafficListItem } from './TrafficListComponent';

export const sortFields: SortField<TrafficListItem>[] = [
  {
    id: 'name',
    title: 'Name',
    isNumeric: false,
    param: 'na',
    compare: (a: TrafficListItem, b: TrafficListItem) => a.name.localeCompare(b.name)
  },
  {
    id: 'protocol',
    title: 'Protocol',
    isNumeric: false,
    param: 'pr',
    compare: (a: TrafficListItem, b: TrafficListItem) => a.protocol.localeCompare(b.protocol)
  },
  {
    id: 'rate',
    title: 'Rate',
    isNumeric: false,
    param: 'ra',
    compare: (a: TrafficListItem, b: TrafficListItem) => a.trafficRate.localeCompare(b.trafficRate)
  },
  {
    id: 'percent',
    title: '%Success',
    isNumeric: false,
    param: 'pe',
    compare: (a: TrafficListItem, b: TrafficListItem) => a.trafficPercent.localeCompare(b.trafficPercent)
  },
  {
    id: 'status',
    title: 'Health',
    isNumeric: false,
    param: 'st',
    compare: (a, b) => a.healthStatus.status.priority - b.healthStatus.status.priority
  }
];

export const availableFilters: FilterType[] = [];

/** Sort Method */

export const sortTrafficListItems = (
  unsorted: TrafficListItem[],
  sortField: SortField<TrafficListItem>,
  isAscending: boolean
): TrafficListItem[] => {
  return unsorted.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
};
