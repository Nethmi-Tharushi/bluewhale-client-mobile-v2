import React from 'react';
import UICard from './ui/Card';

export default function Card(props: React.ComponentProps<typeof UICard>) {
  return <UICard {...props} />;
}

