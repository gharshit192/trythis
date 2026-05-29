import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';

const getStatusBadge = (status) => {
  switch (status) {
    case 'PENDING':
      return { bg: '#e8e8e8', color: '#666', label: 'Queued' };
    case 'PROCESSING':
      return { bg: '#ffeaa7', color: '#d68910', label: 'Processing' };
    case 'COMPLETED':
      return { bg: '#d3f9d8', color: '#16a766', label: 'Ready' };
    case 'FAILED':
      return { bg: '#fce7f3', color: '#ec4899', label: 'Failed' };
    default:
      return { bg: '#f0f0f0', color: '#999', label: status };
  }
};

export function UploadJobsPanel({ jobs, onDismiss }) {
  if (!jobs || jobs.length === 0) {
    return null;
  }

  return (
    <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: '#eee' }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 12 }}>
        Uploads in progress ({jobs.length})
      </Text>
      <ScrollView>
        {jobs.map((job) => (
          <JobCard key={job.jobId} job={job} onDismiss={() => onDismiss(job.jobId)} />
        ))}
      </ScrollView>
    </View>
  );
}

function JobCard({ job, onDismiss }) {
  const badge = getStatusBadge(job.status);
  const isProcessing = job.status === 'PROCESSING';
  const isCompleted = job.status === 'COMPLETED';
  const isFailed = job.status === 'FAILED';

  return (
    <View
      style={{
        borderWidth: 0.5,
        borderColor: '#eee',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        backgroundColor: '#fafafa',
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: '#1a1a1a', marginBottom: 4 }}>
            {job.type === 'LINK' ? '🔗 Link' : '📸 Screenshot'}
          </Text>
          {job.sourceUrl ? (
            <Text numberOfLines={1} style={{ fontSize: 11, color: '#666' }}>
              {job.sourceUrl}
            </Text>
          ) : (
            <Text numberOfLines={1} style={{ fontSize: 11, color: '#666' }}>
              {job.originalFilename}
            </Text>
          )}
        </View>

        {/* Dismiss button */}
        {!isProcessing && (
          <Pressable
            onPress={onDismiss}
            style={{ paddingLeft: 8 }}
          >
            <Text style={{ fontSize: 16, color: '#ccc' }}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {isProcessing && <ActivityIndicator size="small" color={badge.color} />}
        <View
          style={{
            backgroundColor: badge.bg,
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: 6,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '500', color: badge.color }}>
            {badge.label}
          </Text>
        </View>

        {isFailed && (
          <Text style={{ fontSize: 11, color: '#ec4899', fontWeight: '500' }}>
            {job.errorMessage || 'Failed'}
          </Text>
        )}
      </View>

      {/* Completed result */}
      {isCompleted && job.result && (
        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#eee' }}>
          <Text style={{ fontSize: 11, fontWeight: '500', color: '#16a766' }}>✓ Saved as:</Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: '#1a1a1a', marginTop: 2 }}>
            {job.result.title}
          </Text>
        </View>
      )}
    </View>
  );
}

export default UploadJobsPanel;
