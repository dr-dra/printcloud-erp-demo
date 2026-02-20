'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  Label,
  Select,
  Spinner,
  Alert,
  TextInput,
  Textarea,
  ToggleSwitch,
} from 'flowbite-react';
import { HiUser, HiPrinter, HiSave, HiRefresh, HiMail, HiEye } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import ProfilePictureUpload from '@/components/ProfilePictureUpload';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { usePrintCloudClient } from '@/hooks/usePrintCloudClient';
import { useTheme } from 'next-themes';

interface PrinterSettings {
  default_a4_printer: string | null;
  default_a5_printer: string | null;
  default_pos_printer: string | null;
}

interface LocalPrinterSettings {
  default_a4_printer: string;
  default_a5_printer: string;
  default_pos_printer: string;
}

interface EmployeeData {
  id: number;
  full_name: string;
  profile_picture: string | null;
  address: string;
  phone: string;
  emergency_contact: string;
  nic: string;
  department: string;
  designation: string;
  date_of_joining: string;
  date_of_birth: string;
}

interface UserProfile {
  id: number;
  email: string;
  username: string;
  role: string;
  theme: string;
  sidebar_behavior?: 'overlay' | 'push';
  grid_rows_per_page: number | null;
  printer_settings?: PrinterSettings;
  employee?: EmployeeData | null;
}

interface PasswordChangeData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const {
    isAvailable: clientsAvailable,
    printers: availablePrinters,
    loading: printersLoading,
    fetchPrinters,
    printersCount,
  } = usePrintCloudClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Form states
  const [printerSettings, setPrinterSettings] = useState<LocalPrinterSettings>({
    default_a4_printer: '',
    default_a5_printer: '',
    default_pos_printer: '',
  });

  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    designation: '',
    nic: '',
    address: '',
    phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  const [passwordForm, setPasswordForm] = useState<PasswordChangeData>({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [appearanceSettings, setAppearanceSettings] = useState({
    theme: 'dark',
    sidebar_behavior: 'overlay' as 'overlay' | 'push',
    grid_rows_per_page: 25,
  });

  // Fetch user profile and populate form states
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await api.get<UserProfile>('/users/profile/');
        const profileData = response.data;

        // Set printer settings
        if (profileData.printer_settings) {
          setPrinterSettings({
            default_a4_printer: profileData.printer_settings.default_a4_printer || '',
            default_a5_printer: profileData.printer_settings.default_a5_printer || '',
            default_pos_printer: profileData.printer_settings.default_pos_printer || '',
          });
        }

        // Set profile form data
        if (profileData.employee) {
          const nameParts = profileData.employee.full_name.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          const emergencyParts = profileData.employee.emergency_contact.split(' - ');
          const emergencyName = emergencyParts[0] || '';
          const emergencyPhone = emergencyParts[1] || '';

          setProfileForm({
            first_name: firstName,
            last_name: lastName,
            email: profileData.email,
            username: profileData.username || '',
            designation: profileData.employee.designation,
            nic: profileData.employee.nic,
            address: profileData.employee.address,
            phone: profileData.employee.phone,
            emergency_contact_name: emergencyName,
            emergency_contact_phone: emergencyPhone,
          });
        } else {
          setProfileForm((prev) => ({
            ...prev,
            email: profileData.email,
            username: profileData.username || '',
          }));
        }

        // Set appearance settings
        setAppearanceSettings({
          theme: profileData.theme,
          sidebar_behavior: profileData.sidebar_behavior || 'overlay',
          grid_rows_per_page: profileData.grid_rows_per_page || 25,
        });
      } catch (err) {
        setError('Failed to load profile');
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  // Handler functions
  const handleProfileSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const fullName = `${profileForm.first_name} ${profileForm.last_name}`.trim();
      const emergencyContact =
        `${profileForm.emergency_contact_name} - ${profileForm.emergency_contact_phone}`.trim();

      await api.patch('/users/profile/', {
        username: profileForm.username,
        employee: {
          full_name: fullName,
          address: profileForm.address,
          phone: profileForm.phone,
          emergency_contact: emergencyContact,
          nic: profileForm.nic,
          designation: profileForm.designation,
        },
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    try {
      setSaving(true);
      setError(null);

      await api.post('/users/profile/change-password/', passwordForm);

      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleAppearanceSave = async () => {
    try {
      setSaving(true);
      setError(null);

      await api.patch('/users/profile/', {
        theme: appearanceSettings.theme,
        sidebar_behavior: appearanceSettings.sidebar_behavior,
        grid_rows_per_page: appearanceSettings.grid_rows_per_page,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Failed to save appearance settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePrinterSave = async () => {
    try {
      setSaving(true);
      setError(null);

      await api.patch('/users/profile/', {
        printer_settings: printerSettings,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Failed to save printer settings');
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePictureSuccess = () => {
    // Profile picture updated - the useProfilePicture hook will handle cache refresh
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Profile & Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account settings and preferences
          </p>
        </div>

        {success && (
          <Alert color="success" className="mb-4">
            Settings saved successfully!
          </Alert>
        )}

        {error && (
          <Alert color="failure" className="mb-4">
            {error}
          </Alert>
        )}

        {/* Custom Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 0, name: 'Profile', icon: HiUser },
              { id: 1, name: 'Appearance', icon: HiEye },
              { id: 2, name: 'Email Settings', icon: HiMail },
              { id: 3, name: 'Print Settings', icon: HiPrinter },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-1 py-4 text-sm font-medium border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 0 && (
          <div className="space-y-6">
            {/* Profile Picture Section */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Profile Picture
              </h3>
              <ProfilePictureUpload
                onUploadSuccess={handleProfilePictureSuccess}
                onError={setError}
              />
            </Card>

            {/* Personal Information */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name" value="First Name" />
                  <TextInput
                    id="first_name"
                    value={profileForm.first_name}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, first_name: e.target.value }))
                    }
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name" value="Last Name" />
                  <TextInput
                    id="last_name"
                    value={profileForm.last_name}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, last_name: e.target.value }))
                    }
                    placeholder="Enter last name"
                  />
                </div>
                <div>
                  <Label htmlFor="email" value="Email" />
                  <TextInput
                    id="email"
                    type="email"
                    value={profileForm.email}
                    readOnly={user?.role !== 'admin'}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email"
                  />
                </div>
                <div>
                  <Label htmlFor="designation" value="Job Title" />
                  <TextInput
                    id="designation"
                    value={profileForm.designation}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, designation: e.target.value }))
                    }
                    placeholder="Enter job title"
                  />
                </div>
                <div>
                  <Label htmlFor="nic" value="NIC No." />
                  <TextInput
                    id="nic"
                    value={profileForm.nic}
                    readOnly={user?.role !== 'admin'}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, nic: e.target.value }))}
                    placeholder="Enter NIC number"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" value="Phone Number" />
                  <TextInput
                    id="phone"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              <div className="mt-4">
                <Label htmlFor="address" value="Address" />
                <Textarea
                  id="address"
                  rows={3}
                  value={profileForm.address}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="emergency_contact_name" value="Emergency Contact Name" />
                  <TextInput
                    id="emergency_contact_name"
                    value={profileForm.emergency_contact_name}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        emergency_contact_name: e.target.value,
                      }))
                    }
                    placeholder="Enter emergency contact name"
                  />
                </div>
                <div>
                  <Label htmlFor="emergency_contact_phone" value="Emergency Contact Phone" />
                  <TextInput
                    id="emergency_contact_phone"
                    value={profileForm.emergency_contact_phone}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        emergency_contact_phone: e.target.value,
                      }))
                    }
                    placeholder="Enter emergency contact phone"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleProfileSave} disabled={saving} className="min-w-[120px]">
                  {saving ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <HiSave className="mr-2 h-4 w-4" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Change Password */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Change Password
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="current_password" value="Current Password" />
                  <TextInput
                    id="current_password"
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }))
                    }
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <Label htmlFor="new_password" value="New Password" />
                  <TextInput
                    id="new_password"
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))
                    }
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm_password" value="Confirm New Password" />
                  <TextInput
                    id="confirm_password"
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))
                    }
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handlePasswordChange}
                  disabled={
                    saving ||
                    !passwordForm.current_password ||
                    !passwordForm.new_password ||
                    !passwordForm.confirm_password
                  }
                  color="yellow"
                  className="min-w-[140px]"
                >
                  {saving ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Changing...
                    </>
                  ) : (
                    <>
                      <HiSave className="mr-2 h-4 w-4" />
                      Change Password
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 1 && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Appearance Settings
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="theme" value="Dark Mode" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Toggle between light and dark theme
                  </p>
                </div>
                <ToggleSwitch
                  id="theme"
                  checked={theme === 'dark'}
                  onChange={(checked) => {
                    const newTheme = checked ? 'dark' : 'light';
                    // Apply theme immediately (like TopNavBar)
                    setTheme(newTheme);
                    // Update local state for saving to API
                    setAppearanceSettings((prev) => ({
                      ...prev,
                      theme: newTheme,
                    }));
                    // Auto-save to backend
                    api.patch('/users/profile/', { theme: newTheme }).catch((err) => {
                      console.error('Failed to save theme preference:', err);
                    });
                  }}
                />
              </div>

              <div>
                <Label htmlFor="sidebar_behavior" value="Sidebar Behavior" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Choose how the navigation panel behaves on desktop
                </p>
                <Select
                  id="sidebar_behavior"
                  value={appearanceSettings.sidebar_behavior}
                  onChange={(e) =>
                    setAppearanceSettings((prev) => ({
                      ...prev,
                      sidebar_behavior: e.target.value as 'overlay' | 'push',
                    }))
                  }
                >
                  <option value="overlay">Overlay (floats over content)</option>
                  <option value="push">Push (shifts content)</option>
                </Select>
                <Alert color="info" className="mt-3">
                  <div className="text-sm">
                    <strong>Keyboard shortcuts:</strong> Ctrl/Cmd + Shift + O (Overview), S (Sales),
                    A (Accounting), Z (Production), X (Inventory).
                  </div>
                </Alert>
              </div>

              <div>
                <Label htmlFor="grid_rows" value="Grid View Rows" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Number of rows per page (1-100, leave empty for auto)
                </p>
                <TextInput
                  id="grid_rows"
                  type="number"
                  min="1"
                  max="100"
                  value={appearanceSettings.grid_rows_per_page}
                  onChange={(e) =>
                    setAppearanceSettings((prev) => ({
                      ...prev,
                      grid_rows_per_page: parseInt(e.target.value) || 25,
                    }))
                  }
                  placeholder="Enter number of rows (1-100)"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={handleAppearanceSave} disabled={saving} className="min-w-[120px]">
                {saving ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <HiSave className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}

        {activeTab === 2 && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Email Settings
            </h3>
            <Alert color="info">
              <div className="text-sm">
                <strong>Coming Soon:</strong> Email settings and notifications will be available in
                a future update.
              </div>
            </Alert>
          </Card>
        )}

        {activeTab === 3 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Default Printers
              </h3>
              <div className="flex items-center space-x-2">
                {clientsAvailable && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {printersCount.online}/{printersCount.total} printers online
                  </div>
                )}
                <Button
                  size="xs"
                  color="gray"
                  onClick={() => fetchPrinters({ forceRefresh: true })}
                  disabled={printersLoading}
                >
                  <HiRefresh className="w-3 h-3 mr-1" />
                  {printersLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
            </div>

            {!clientsAvailable && (
              <Alert color="warning" className="mb-4">
                <div className="text-sm">
                  <strong>PrintCloudClient Required:</strong> No PrintCloudClient instances are
                  currently online. Please ensure the PrintCloudClient desktop application is
                  running on at least one computer in your network.
                </div>
              </Alert>
            )}

            {clientsAvailable && printersCount.total === 0 && (
              <Alert color="info" className="mb-4">
                <div className="text-sm">
                  <strong>No Printers Found:</strong> PrintCloudClient is online but no printers
                  were detected. Please check your printer connections and click Refresh.
                </div>
              </Alert>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="a4_printer" value="A4 Documents" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  For quotations, invoices, orders, job tickets
                </p>
                <Select
                  id="a4_printer"
                  value={printerSettings.default_a4_printer}
                  onChange={(e) =>
                    setPrinterSettings((prev) => ({
                      ...prev,
                      default_a4_printer: e.target.value,
                    }))
                  }
                  disabled={!clientsAvailable}
                >
                  <option value="">Select A4 printer...</option>
                  {clientsAvailable ? (
                    availablePrinters
                      .filter((printer) => printer.printer_type === 'standard')
                      .map((printer) => (
                        <option key={`${printer.client_id}-${printer.name}`} value={printer.name}>
                          {printer.displayName}
                        </option>
                      ))
                  ) : (
                    <option disabled>PrintCloudClient required</option>
                  )}
                </Select>
              </div>

              <div>
                <Label htmlFor="a5_printer" value="A5 Documents" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  For dispatch notes, payment receipts
                </p>
                <Select
                  id="a5_printer"
                  value={printerSettings.default_a5_printer}
                  onChange={(e) =>
                    setPrinterSettings((prev) => ({
                      ...prev,
                      default_a5_printer: e.target.value,
                    }))
                  }
                  disabled={!clientsAvailable}
                >
                  <option value="">Select A5 printer...</option>
                  {clientsAvailable ? (
                    availablePrinters
                      .filter((printer) => printer.printer_type === 'standard')
                      .map((printer) => (
                        <option key={`${printer.client_id}-${printer.name}`} value={printer.name}>
                          {printer.displayName}
                        </option>
                      ))
                  ) : (
                    <option disabled>PrintCloudClient required</option>
                  )}
                </Select>
              </div>

              <div>
                <Label htmlFor="pos_printer" value="POS Receipts" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  For thermal receipt printing
                </p>
                <Select
                  id="pos_printer"
                  value={printerSettings.default_pos_printer}
                  onChange={(e) =>
                    setPrinterSettings((prev) => ({
                      ...prev,
                      default_pos_printer: e.target.value,
                    }))
                  }
                  disabled={!clientsAvailable}
                >
                  <option value="">Select POS printer...</option>
                  {clientsAvailable ? (
                    availablePrinters
                      .filter((printer) => printer.printer_type === 'pos')
                      .map((printer) => (
                        <option key={`${printer.client_id}-${printer.name}`} value={printer.name}>
                          {printer.displayName}
                        </option>
                      ))
                  ) : (
                    <option disabled>PrintCloudClient required</option>
                  )}
                </Select>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={handlePrinterSave} disabled={saving} className="min-w-[120px]">
                {saving ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <HiSave className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
