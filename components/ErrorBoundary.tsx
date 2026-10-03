import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sentry } from '../lib/sentry';
import { Colors, Spacing, Typography } from '../constants';
import { AppButton } from './ui/AppButton';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Une erreur est survenue</Text>
          <Text style={styles.message}>Réessaie, ou reviens plus tard si le problème persiste.</Text>
          <AppButton label="Réessayer" onPress={this.handleRetry} style={styles.button} />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  title: {
    ...Typography.titleMd,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  message: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  button: {
    minWidth: 160,
  },
});
