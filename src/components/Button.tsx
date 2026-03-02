import React from 'react';
import UIButton from './ui/Button';

export default function Button(props: React.ComponentProps<typeof UIButton>) {
  return <UIButton {...props} />;
}

