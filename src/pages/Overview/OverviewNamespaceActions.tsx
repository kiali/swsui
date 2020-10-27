import * as React from 'react';
import {
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownSeparator,
  KebabToggle,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';

export type OverviewNamespaceAction = {
  isGroup: boolean;
  isSeparator: boolean;
  isDisabled: boolean;
  title?: string;
  children?: OverviewNamespaceAction[];
  action?: (namespace: string) => void;
};

type Props = {
  namespace: string;
  actions: OverviewNamespaceAction[];
};

type State = {
  isKebabOpen: boolean;
};

export class OverviewNamespaceActions extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isKebabOpen: false
    };
  }

  onKebabToggle = (isOpen: boolean) => {
    this.setState({
      isKebabOpen: isOpen
    });
  };

  renderTooltip = (key, position, msg, child): any => {
    return (
      <Tooltip key={'tooltip_' + key} position={position} content={<>{msg}</>}>
        <div style={{ display: 'inline-block', cursor: 'not-allowed' }}>{child}</div>
      </Tooltip>
    );
  };

  componentDidUpdate(_: Readonly<Props>, prevState: Readonly<State>) {
    if (prevState.isKebabOpen) {
      this.setState({
        isKebabOpen: false
      });
    }
  }

  render() {
    const namespaceActions = this.props.actions.map((action, i) => {
      if (action.isSeparator) {
        return <DropdownSeparator key={'separator_' + i} />;
      }
      if (action.isGroup && action.children) {
        return (
          <DropdownGroup
            key={'group_' + i}
            label={action.title}
            className="kiali-group-menu"
            children={action.children.map((subaction, j) => {
              const itemKey = 'subaction_' + i + '_' + j;
              const item = (
                <DropdownItem
                  key={itemKey}
                  onClick={() => (subaction.action ? subaction.action(this.props.namespace) : undefined)}
                >
                  {subaction.title}
                </DropdownItem>
              );
              return subaction.isDisabled
                ? this.renderTooltip(
                    'tooltip_' + itemKey,
                    TooltipPosition.left,
                    'User has not enough permissions for this action',
                    item
                  )
                : item;
            })}
          />
        );
      } else if (action.title && action.action) {
        return (
          <DropdownItem
            key={'action_' + i}
            onClick={() => (action.action ? action.action(this.props.namespace) : undefined)}
          >
            {action.title}
          </DropdownItem>
        );
      }
      return undefined;
    });
    return (
      <Dropdown
        toggle={<KebabToggle onToggle={this.onKebabToggle} />}
        dropdownItems={namespaceActions}
        isPlain={true}
        isOpen={this.state.isKebabOpen}
        position={'right'}
      />
    );
  }
}
