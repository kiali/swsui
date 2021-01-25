import { SummaryTable, SummaryTableRenderer } from './BaseTable';
import { ICell, ISortBy, sortable } from '@patternfly/react-table';
import { RouteSummary } from '../../../types/IstioObjects';
import { ActiveFilter, FILTER_ACTION_APPEND, FilterType, FilterTypes } from '../../../types/Filters';
import { SortField } from '../../../types/SortFilters';
import { defaultFilter } from './FiltersAndSorts';
import Namespace from '../../../types/Namespace';
import { istioConfigLink, serviceLink } from './helpers';

export class RouteTable implements SummaryTable {
  summaries: RouteSummary[];
  sortingIndex: number;
  sortingDirection: 'asc' | 'desc';
  namespaces: Namespace[] | undefined;
  namespace: string;

  constructor(summaries: RouteSummary[], sortBy: ISortBy, namespaces: Namespace[] | undefined, namespace: string) {
    this.summaries = summaries;
    this.sortingIndex = sortBy.index || 0;
    this.sortingDirection = sortBy.direction || 'asc';
    this.namespaces = namespaces;
    this.namespace = namespace;
  }

  availableFilters = (): FilterType[] => {
    return [
      {
        id: 'name',
        title: 'Name',
        placeholder: 'Name',
        filterType: FilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        id: 'domains',
        title: 'Domains',
        placeholder: 'Domains',
        filterType: FilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      }
    ];
  };

  filterMethods = (): { [filter_id: string]: (ClusterSummary, ActiveFilter) => boolean } => {
    return {
      name: (entry: RouteSummary, filter: ActiveFilter): boolean => {
        return entry.name.toString().includes(filter.value);
      },
      domains: (entry: RouteSummary, filter: ActiveFilter): boolean => {
        return [entry.domains.service, entry.domains.namespace, entry.domains.cluster]
          .join('.')
          .includes(filter.value);
      },
    };
  };

  sortFields = (): SortField<RouteSummary>[] => {
    return [
      {
        id: 'name',
        title: 'Name',
        isNumeric: false,
        param: 'name',
        compare: (a, b) => {
          return a.name.localeCompare(b.name);
        }
      },
      {
        id: 'domains',
        title: 'Domains',
        isNumeric: false,
        param: 'doms',
        compare: (a, b) => {
        return [a.domains.service, a.domains.namespace, a.domains.cluster]
          .join('.')
          .localeCompare([b.domains.service, b.domains.namespace, b.domains.cluster].join('.'));
  }
      }
    ];
  };

  head(): ICell[] {
    return [
      { title: 'Name', transforms: [sortable] },
      { title: 'Domains', transforms: [sortable] },
      { title: 'Match', transforms: [sortable] },
      { title: 'Virtual Service', transforms: [sortable] }
    ];
  }

  resource = (): string => 'routes';

  setSorting = (columnIndex: number, direction: 'asc' | 'desc') => {
    this.sortingDirection = direction;
    this.sortingIndex = columnIndex;
  };

  sortBy = (): ISortBy => {
    return {
      index: this.sortingIndex,
      direction: this.sortingDirection
    };
  };

  rows(): (string | number | JSX.Element)[][] {
    return this.summaries
      .filter((value: RouteSummary) => {
        return defaultFilter(value, this.filterMethods());
      })
      .sort((a: RouteSummary, b: RouteSummary) => {
        return this.sortFields()
          .find((value: SortField<RouteSummary>): boolean => {
            return value.id === this.sortFields()[this.sortingIndex].id;
          })!
          .compare(a, b);
      })
      .map((summary: RouteSummary): (string | number | JSX.Element)[] => {
        return [summary.name, serviceLink(summary.domains, this.namespaces, this.namespace, true), summary.match, istioConfigLink(summary.virtual_service, 'virtualservice')];
      });
  }
}

export const RouteSummaryTable = SummaryTableRenderer<RouteTable>();
