import { useState } from 'react';
import { getClient, Guest } from '../lib/supabase';
import { User, CreditCard, Phone, Mail, MapPin, Save, X, Loader2 } from 'lucide-react';

interface GuestEditModalProps {
  guest: Guest;
  onClose: () => void;
  onSave: () => void;
}

export function GuestEditModal({ guest, onClose, onSave }: GuestEditModalProps) {
  const [dni, setDni] = useState(guest.dni);
  const [name, setName] = useState(guest.name);
  const [phone, setPhone] = useState(guest.phone || '');
  const [email, setEmail] = useState(guest.email || '');
  const [address, setAddress] = useState(guest.address || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!/^\d{8}$/.test(dni)) { setError('El DNI debe tener exactamente 8 dígitos'); return; }
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setError(null);
    setLoading(true);

    if (dni !== guest.dni) {
      const { data: existingGuest, error: lookupError } = await getClient()
        .from('guests')
        .select('id')
        .eq('dni', dni)
        .neq('id', guest.id)
        .maybeSingle();
      if (lookupError) {
        setLoading(false);
        setError('No se pudo validar el DNI. Inténtalo nuevamente.');
        return;
      }
      if (existingGuest) {
        setLoading(false);
        setError('El DNI ya existe');
        return;
      }
    }

    const { error: err } = await getClient()
      .from('guests')
      .update({ dni, name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, address: address.trim() || null })
      .eq('id', guest.id);
    setLoading(false);
    if (err) {
      setError(err.code === '23505' || err.message.toLowerCase().includes('duplicate') ? 'El DNI ya existe' : err.message);
      return;
    }
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="border-b border-gray-100 dark:border-zinc-800 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800 dark:text-zinc-100">Editar Huesped</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1">DNI</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-600" />
              <input
                type="text"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                inputMode="numeric"
                maxLength={8}
                className="w-full pl-10 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1">Nombre completo *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1">Telefono</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Telefono"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1">Direccion</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-10 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Direccion"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}
        </div>

        <div className="border-t border-gray-100 dark:border-zinc-800 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading || dni.length !== 8 || !name.trim()}
            className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-700"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
