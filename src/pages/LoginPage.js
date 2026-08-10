import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, TextInput, PasswordInput, Button, Text, Alert, Stack, Center, Box, Image } from '@mantine/core';
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="login-page">
      <Center mih="100vh" p="md">
        <Paper radius="lg" p="xl" shadow="lg" w="100%" maw={420}>
          <Image src="/carribu-logo.jpg" alt="Carribu School Transport" w={260} maw="100%" mx="auto" fit="contain" />
          <Text ta="center" c="dimmed" size="sm" mt={4} mb="xl">Sign in to manage your school's transport fleet</Text>

          {error && <Alert color="red" icon={<IconAlertCircle size={16} />} mb="md">{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="Email"
                type="email"
                placeholder="admin@school.co.ke"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <PasswordInput
                label="Password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <Button type="submit" fullWidth size="md" loading={loading} mt="xs">
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </Stack>
          </form>

          <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />} mt="xl">
            <Text size="sm" fw={600}>Carribu App — Nairobi Academy</Text>
            <Text size="xs">Admin: admin@nairobiacademy.co.ke / admin123</Text>
            <Text size="xs">Driver: driver1@nairobiacademy.co.ke / driver123</Text>
            <Text size="xs">Parent: parent1@gmail.com / parent123</Text>
          </Alert>
        </Paper>
      </Center>
    </Box>
  );
};

export default LoginPage;
