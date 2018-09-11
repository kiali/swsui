import { GraphState } from '../store/Store';
import { GraphDataActionKeys } from '../actions/GraphDataActionKeys';
import { GraphActionKeys } from '../actions/GraphActions';
import FilterStateReducer from './GraphFilterState';

const INITIAL_STATE: GraphState = {
  isLoading: false,
  isError: false,
  error: undefined,
  graphDataTimestamp: 0,
  graphData: {},
  sidePanelInfo: null,
  filterState: {
    showLegend: false,
    showNodeLabels: true,
    showCircuitBreakers: true,
    showVirtualServices: true,
    showMissingSidecars: true,
    showTrafficAnimation: false
  }
};

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
const graphDataState = (state: GraphState = INITIAL_STATE, action) => {
  const filterState = FilterStateReducer(state.filterState, action);
  let newState: GraphState = {
    ...state,
    filterState
  };

  switch (action.type) {
    case GraphDataActionKeys.GET_GRAPH_DATA_START:
      newState.isLoading = true;
      newState.isError = false;
      break;
    case GraphDataActionKeys.GET_GRAPH_DATA_SUCCESS:
      newState.isLoading = false;
      newState.isError = false;
      newState.graphDataTimestamp = action.timestamp;
      newState.graphData = action.graphData;
      break;
    case GraphDataActionKeys.GET_GRAPH_DATA_FAILURE:
      newState.isLoading = false;
      newState.isError = true;
      newState.error = action.error;
      break;
    case GraphActionKeys.GRAPH_SIDE_PANEL_SHOW_INFO:
      newState.sidePanelInfo = {
        kind: action.summaryType,
        graphReference: action.summaryTarget
      };
      break;
    default:
      break;
  }

  return newState;
};

export default graphDataState;
