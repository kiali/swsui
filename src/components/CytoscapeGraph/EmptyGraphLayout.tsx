import * as React from 'react';
import { Button, EmptyState, EmptyStateBody, EmptyStateIcon, EmptyStateVariant, Title } from '@patternfly/react-core';
import { style } from 'typestyle';
import * as _ from 'lodash';
import Namespace from '../../types/Namespace';
import { KialiIcon } from '../../config/KialiIcon';
import { DecoratedGraphElements } from '../../types/Graph';

type EmptyGraphLayoutProps = {
  elements?: DecoratedGraphElements;
  namespaces: Namespace[];
  action?: any;
  displayUnusedNodes: () => void;
  isDisplayingUnusedNodes: boolean;
  isLoading?: boolean;
  isError: boolean;
  isMiniGraph: boolean;
  error?: string;
};

const emptyStateStyle = style({
  height: '98%',
  marginRight: 'auto',
  marginLeft: 'auto',
  marginBottom: 10,
  marginTop: 10
});

type EmptyGraphLayoutState = {};

export default class EmptyGraphLayout extends React.Component<EmptyGraphLayoutProps, EmptyGraphLayoutState> {
  shouldComponentUpdate(nextProps: EmptyGraphLayoutProps) {
    const currentIsEmpty = this.props.elements === undefined || _.isEmpty(this.props.elements.nodes);
    const nextIsEmpty = nextProps.elements === undefined || _.isEmpty(nextProps.elements.nodes);

    // Update if we have elements and we are not loading
    if (!nextProps.isLoading && !nextIsEmpty) {
      return true;
    }

    // Update if we are going from having no elements to having elements or vice versa
    if (currentIsEmpty !== nextIsEmpty) {
      return true;
    }
    // Do not update if we have elements and the namespace didn't change, as this means we are refreshing
    return !(!nextIsEmpty && this.props.namespaces === nextProps.namespaces);
  }

  namespacesText() {
    if (this.props.namespaces && this.props.namespaces.length > 0) {
      if (this.props.namespaces.length === 1) {
        return (
          <>
            namespace <b>{this.props.namespaces[0].name}</b>
          </>
        );
      } else {
        const namespacesString =
          this.props.namespaces
            .slice(0, -1)
            .map(namespace => namespace.name)
            .join(',') +
          ' and ' +
          this.props.namespaces[this.props.namespaces.length - 1].name;
        return (
          <>
            namespaces <b>{namespacesString}</b>
          </>
        );
      }
    }
    return null;
  }

  render() {
    if (this.props.isError) {
      return (
        <EmptyState variant={EmptyStateVariant.large} className={emptyStateStyle}>
          <EmptyStateIcon icon={KialiIcon.Error} />
          <Title headingLevel="h5" size="lg">
            Error loading Graph
          </Title>
          <EmptyStateBody>{this.props.error}</EmptyStateBody>
        </EmptyState>
      );
    }
    if (this.props.isLoading) {
      return (
        <EmptyState variant={EmptyStateVariant.large} className={emptyStateStyle}>
          <Title headingLevel="h5" size="lg">
            Loading Graph
          </Title>
        </EmptyState>
      );
    }

    if (this.props.namespaces.length === 0) {
      return (
        <EmptyState variant={EmptyStateVariant.large} className={emptyStateStyle}>
          <Title headingLevel="h5" size="lg">
            No namespace is selected
          </Title>
          <EmptyStateBody>
            There is currently no namespace selected, please select one using the Namespace selector.
          </EmptyStateBody>
        </EmptyState>
      );
    }

    const isGraphEmpty = !this.props.elements || !this.props.elements.nodes || this.props.elements.nodes.length < 1;

    if (isGraphEmpty && !this.props.isMiniGraph) {
      return (
        <EmptyState variant={EmptyStateVariant.large} className={emptyStateStyle}>
          <Title headingLevel="h5" size="lg">
            Empty Graph
          </Title>
          <EmptyStateBody>
            There is currently no graph available for {this.namespacesText()}. This could either mean there is no
            service mesh available for {this.props.namespaces.length === 1 ? 'this namespace' : 'these namespaces'} or
            the service mesh has yet to see request traffic.
            {this.props.isDisplayingUnusedNodes && (
              <> You are currently displaying 'Unused nodes', send requests to the service mesh and click 'Refresh'.</>
            )}
            {!this.props.isDisplayingUnusedNodes && (
              <>
                {' '}
                You can enable 'Unused nodes' to display service mesh nodes that have yet to see any request traffic.
              </>
            )}
          </EmptyStateBody>
          <Button
            onClick={this.props.isDisplayingUnusedNodes ? this.props.action : this.props.displayUnusedNodes}
            variant="primary"
          >
            {(this.props.isDisplayingUnusedNodes && <>Refresh</>) || <>Display unused nodes</>}
          </Button>
        </EmptyState>
      );
    }

    if (isGraphEmpty && this.props.isMiniGraph) {
      return (
        <EmptyState variant={EmptyStateVariant.large} className={emptyStateStyle}>
          <Title headingLevel="h5" size="lg">
            Empty Graph
          </Title>
          <EmptyStateBody>Not enough data to generate a graph.</EmptyStateBody>
        </EmptyState>
      );
    }

    return this.props.children;
  }
}
