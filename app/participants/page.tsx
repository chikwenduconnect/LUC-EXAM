'use client';

import { useState } from 'react';
import { Plus, Search, Trash2, Mail } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

type Participant = {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'pending';
  enrolledDate: string;
};

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: 'John Doe', email: 'john@example.com', status: 'active', enrolledDate: '2023-10-01' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'pending', enrolledDate: '2023-10-02' },
  ]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ name: '', email: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipant.name || !newParticipant.email) return;
    
    setParticipants([...participants, {
      id: Math.random().toString(36).substring(7),
      ...newParticipant,
      status: 'active',
      enrolledDate: new Date().toISOString().split('T')[0]
    }]);
    
    setNewParticipant({ name: '', email: '' });
    setIsAddModalOpen(false);
  };

  const filteredParticipants = participants.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Participants</h1>
          <p className="text-gray-500 mt-1">Manage all students and test-takers</p>
        </div>
        
        <Dialog.Root open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <Dialog.Trigger asChild>
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              <Plus size={20} />
              Add Participant Manually
            </button>
          </Dialog.Trigger>
          
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-6 w-full max-w-md z-50">
              <Dialog.Title className="text-xl font-semibold mb-4">Add New Participant</Dialog.Title>
              
              <form onSubmit={handleAddParticipant} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    required
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter full name"
                    value={newParticipant.name}
                    onChange={(e) => setNewParticipant({...newParticipant, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input 
                    type="email" 
                    required
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email address"
                    value={newParticipant.email}
                    onChange={(e) => setNewParticipant({...newParticipant, email: e.target.value})}
                  />
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
                    Add Participant
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search participants by name or email..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-gray-50/50">
              <th className="p-4 font-medium text-gray-600">Name</th>
              <th className="p-4 font-medium text-gray-600">Email</th>
              <th className="p-4 font-medium text-gray-600">Enrolled Date</th>
              <th className="p-4 font-medium text-gray-600">Status</th>
              <th className="p-4 font-medium text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredParticipants.length > 0 ? filteredParticipants.map((participant) => (
              <tr key={participant.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                <td className="p-4 font-medium text-gray-900">{participant.name}</td>
                <td className="p-4 text-gray-600">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-400" />
                    {participant.email}
                  </div>
                </td>
                <td className="p-4 text-gray-600">{participant.enrolledDate}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    participant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {participant.status.charAt(0).toUpperCase() + participant.status.slice(1)}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button 
                    onClick={() => setParticipants(participants.filter(p => p.id !== participant.id))}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No participants found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
