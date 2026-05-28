import { View, Text, TouchableOpacity } from 'react-native';

export default function OnboardingScreen({ navigation }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 20 }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            backgroundColor: '#1B3A2F',
            borderRadius: 20,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <Text style={{ fontSize: 40 }}>📌</Text>
        </View>

        <Text
          style={{
            fontSize: 32,
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: 16,
            lineHeight: 1.2,
          }}
        >
          You save things.
        </Text>

        <Text
          style={{
            fontSize: 32,
            fontWeight: '700',
            color: '#666',
            textAlign: 'center',
            marginBottom: 32,
            lineHeight: 1.2,
          }}
        >
          Then forget them.
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: '#666',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          TryThis remembers so you don't have to.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Signup')}
          style={{
            backgroundColor: '#16a766',
            paddingVertical: 14,
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            Get Started
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={{
            backgroundColor: '#f5f5f5',
            paddingVertical: 14,
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#1a1a1a', fontSize: 16, fontWeight: '600' }}>
            Sign In
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
