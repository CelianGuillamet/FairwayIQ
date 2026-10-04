import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sentry } from '../lib/sentry';
import { Spacing, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { useThemedStyles } from '../lib/theme';
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
      return <ErrorFallback onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Une erreur est survenue
      </Text>
      <Text style={styles.message}>Réessaie, ou reviens plus tard si le problème persiste.</Text>
      <AppButton label="Réessayer" onPress={onRetry} style={styles.button} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    title: {
      ...Typography.titleMd,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: Spacing.xs,
    },
    message: {
      ...Typography.body,
      color: colors.ink2,
      textAlign: 'center',
      marginBottom: Spacing.xl,
    },
    button: {
      minWidth: 160,
    },
  });
