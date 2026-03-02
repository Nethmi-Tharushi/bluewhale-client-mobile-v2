import React from 'react';
import UIEmptyState from './ui/EmptyState';

type Props = {
  title: string;
  subtitle?: string;
};

export default function EmptyState({ title, subtitle }: Props) {
  return <UIEmptyState title={title} message={subtitle} icon='?' />;
}

