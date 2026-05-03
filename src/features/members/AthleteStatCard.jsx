import React from 'react';
import AthleteStatus from './AthleteStatus';

/** Admin dashboard card — same visuals as member {@link AthleteStatus} with admin subtitle. */
export default function AthleteStatCard(props) {
  return <AthleteStatus {...props} subtitle="Athlete preview" />;
}
