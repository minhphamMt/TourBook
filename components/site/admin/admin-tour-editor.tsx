"use client"

import { useCallback, useEffect, useState } from "react"
import { Save, X, Image as ImageIcon, Calendar, MapPin, List, Info, AlertTriangle, Plus, Trash, Utensils, Train, Hotel, Edit, CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { StatusPill } from "@/components/site/status-pill"

type ItineraryDay = {
  id?: string
  day_number: number
  title: string
  description: string
  meals: string[]
  accommodation?: string
  transportation?: string
}

type TourDetails = {
  id: string
  name: string
  slug: string
  short_description: string
  description: string
  duration_days: number
  duration_nights: number
  is_featured: boolean
  status: string
  cover_image?: string
  starting_price?: number
  sale_price?: number
  departure_date?: string
  itinerary?: ItineraryDay[]
}

export function AdminTourEditor({ 
  tour, 
  onClose, 
  onSave 
}: { 
  tour: TourDetails, 
  onClose: () => void, 
  onSave: (updated: TourDetails) => Promise<void> 
}) {
  const [formData, setFormData] = useState<TourDetails>(() => ({ 
    ...tour,
    itinerary: (tour.itinerary || []).map(day => ({
      ...day,
      meals: Array.isArray(day.meals) ? day.meals : []
    }))
  }))
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'pricing' | 'content' | 'images' | 'itinerary'>('basic')

  // Sync itinerary days with duration_days
  useEffect(() => {
    const currentDays = formData.itinerary?.length || 0
    if (formData.duration_days > currentDays) {
      const newDays = [...(formData.itinerary || [])]
      for (let i = currentDays + 1; i <= formData.duration_days; i++) {
        newDays.push({
          day_number: i,
          title: `Ngày ${i}: ...`,
          description: "",
          meals: []
        })
      }
      setFormData(prev => ({ ...prev, itinerary: newDays }))
    }
  }, [formData.duration_days])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (err) {
      console.error(err)
      alert("Lỗi khi lưu: " + (err as any).message)
    } finally {
      setIsSaving(false)
    }
  }

  const updateItineraryDay = (index: number, updates: Partial<ItineraryDay>) => {
    const newItinerary = [...(formData.itinerary || [])]
    newItinerary[index] = { ...newItinerary[index], ...updates }
    setFormData(prev => ({ ...prev, itinerary: newItinerary }))
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
              {tour.id ? <Edit className="size-6" /> : <Plus className="size-6" />}
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                {tour.id ? "Chỉnh sửa Tour" : "Tạo Tour Mới"}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {tour.id && <span className="text-sm font-medium text-slate-400">ID: {tour.id}</span>}
                <StatusPill status={formData.status} />
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100 h-10 w-10">
            <X className="size-6" />
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 overflow-x-auto scrollbar-hide">
          {[
            { id: 'basic', label: 'Cơ bản', icon: Info },
            { id: 'pricing', label: 'Giá & Lịch', icon: CreditCard },
            { id: 'content', label: 'Nội dung', icon: List },
            { id: 'itinerary', label: 'Lịch trình', icon: Calendar },
            { id: 'images', label: 'Hình ảnh', icon: ImageIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all whitespace-nowrap border-b-2 ${
                activeTab === tab.id 
                  ? "border-primary text-primary" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {activeTab === 'basic' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 uppercase tracking-widest pl-1">Tên Tour</label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="h-12 rounded-2xl border-slate-200 px-5 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 uppercase tracking-widest pl-1">Trạng thái</label>
                  <select 
                    value={formData.status} 
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="draft">Bản nháp (Draft)</option>
                    <option value="published">Công khai (Published)</option>
                    <option value="archived">Lưu trữ (Archived)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 uppercase tracking-widest pl-1">Số ngày</label>
                  <Input 
                    type="number"
                    value={formData.duration_days} 
                    onChange={(e) => setFormData(prev => ({ ...prev, duration_days: parseInt(e.target.value) }))}
                    className="h-12 rounded-2xl border-slate-200 px-5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 uppercase tracking-widest pl-1">Số đêm</label>
                  <Input 
                    type="number"
                    value={formData.duration_nights} 
                    onChange={(e) => setFormData(prev => ({ ...prev, duration_nights: parseInt(e.target.value) }))}
                    className="h-12 rounded-2xl border-slate-200 px-5"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <input 
                  type="checkbox" 
                  id="featured"
                  checked={formData.is_featured} 
                  onChange={(e) => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))}
                  className="size-5 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <label htmlFor="featured" className="text-sm font-bold text-slate-700 cursor-pointer">Đây là Tour nổi bật (Sẽ hiển thị ở trang chủ)</label>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-[2.5rem] bg-sky-50/50 border border-sky-100 p-8">
                <div className="flex items-center gap-6 mb-8">
                  <div className="flex size-14 items-center justify-center rounded-[1.25rem] bg-sky-600 text-white shadow-lg shadow-sky-600/20">
                    <CreditCard className="size-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Thiết lập giá & Lịch trình</h3>
                    <p className="text-sm text-slate-500 font-medium">Đặt giá cơ bản và áp dụng khuyến mãi cho tour này.</p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-widest pl-1">Giá gốc (VND)</label>
                    <div className="relative">
                      <Input 
                        type="number"
                        value={formData.starting_price || 0} 
                        onChange={(e) => setFormData(prev => ({ ...prev, starting_price: parseInt(e.target.value) }))}
                        className="h-12 rounded-2xl border-slate-200 pl-12 pr-5 font-bold text-lg"
                      />
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₫</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-widest pl-1">Giá khuyến mãi (VND - Tùy chọn)</label>
                    <div className="relative">
                      <Input 
                        type="number"
                        value={formData.sale_price || ""} 
                        onChange={(e) => setFormData(prev => ({ ...prev, sale_price: e.target.value ? parseInt(e.target.value) : undefined }))}
                        className="h-12 rounded-2xl border-slate-200 pl-12 pr-5 font-bold text-lg text-orange-600"
                        placeholder="Để trống nếu không giảm giá"
                      />
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₫</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-widest pl-1">Ngày bắt đầu (Dự kiến)</label>
                    <div className="relative">
                      <Input 
                        type="date"
                        value={formData.departure_date || new Date().toISOString().split('T')[0]} 
                        onChange={(e) => setFormData(prev => ({ ...prev, departure_date: e.target.value }))}
                        className="h-12 rounded-2xl border-slate-200 pl-12 pr-5 font-bold"
                      />
                      <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-6 rounded-[2rem] bg-white border border-slate-100 italic text-slate-500 text-sm">
                  Lưu ý: Giá và ngày khởi hành này sẽ được tạo thành một "Lịch trình" mặc định cho tour. Bạn có thể thêm nhiều ngày khởi hành khác trong mục "Quản lý Lịch trình" chi tiết.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-700 uppercase tracking-widest pl-1">Mô tả ngắn</label>
                      <Textarea 
                        value={formData.short_description || ""} 
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, short_description: e.target.value }))}
                        className="min-h-[100px] rounded-2xl border-slate-200 p-5 focus:ring-primary"
                        placeholder="Mô tả tóm tắt tour..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-700 uppercase tracking-widest pl-1">Chi tiết tour (Markdown/HTML)</label>
                      <Textarea 
                        value={formData.description || ""} 
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="min-h-[300px] rounded-2xl border-slate-200 p-5 focus:ring-primary"
                        placeholder="Mô tả chi tiết các trải nghiệm..."
                      />
                    </div>
            </div>
          )}

          {activeTab === 'itinerary' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Lịch trình chi tiết</h3>
                  <p className="text-sm text-slate-500 font-medium">Lịch trình được tự động đồng bộ theo số ngày đã thiết lập ở tab Cơ bản.</p>
                </div>
              </div>

              <div className="space-y-6">
                {formData.itinerary?.map((day, index) => (
                  <div key={index} className="rounded-[2rem] border border-slate-100 bg-slate-50/50 p-6 overflow-hidden">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex size-10 items-center justify-center rounded-full bg-slate-900 text-white font-black text-sm">
                        {day.day_number}
                      </div>
                      <Input 
                        value={day.title}
                        onChange={(e) => updateItineraryDay(index, { title: e.target.value })}
                        placeholder="Tiêu đề ngày (VD: Hà Nội - Sapa)"
                        className="h-10 border-slate-200 font-bold text-slate-900 rounded-xl"
                      />
                    </div>
                    
                    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                      <div className="space-y-4">
                        <Textarea 
                          value={day.description}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateItineraryDay(index, { description: e.target.value })}
                          placeholder="Mô tả chi tiết các hoạt động trong ngày..."
                          className="min-h-[120px] rounded-xl border-slate-200"
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                              <Hotel className="size-3" /> Chỗ ở
                            </label>
                            <Input 
                              value={day.accommodation || ""}
                              onChange={(e) => updateItineraryDay(index, { accommodation: e.target.value })}
                              placeholder="Khách sạn/Resort..."
                              className="h-9 rounded-lg text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                              <Train className="size-3" /> Di chuyển
                            </label>
                            <Input 
                              value={day.transportation || ""}
                              onChange={(e) => updateItineraryDay(index, { transportation: e.target.value })}
                              placeholder="Xe khách/Máy bay..."
                              className="h-9 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-2xl p-4 border border-slate-100 h-fit">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                          <Utensils className="size-3" /> Bữa ăn trong ngày
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {['Bữa sáng', 'Bữa trưa', 'Bữa tối'].map((meal) => (
                            <label key={meal} className="flex items-center gap-3 text-sm font-bold text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100/50 cursor-pointer hover:bg-slate-100 transition-colors">
                              <input 
                                type="checkbox"
                                checked={(day.meals || []).includes(meal)}
                                onChange={(e) => {
                                  const currentMeals = Array.isArray(day.meals) ? day.meals : []
                                  const newMeals = e.target.checked 
                                    ? [...currentMeals, meal]
                                    : currentMeals.filter(m => m !== meal)
                                  updateItineraryDay(index, { meals: newMeals })
                                }}
                                className="size-4 rounded border-slate-300 text-primary"
                              />
                              {meal.replace("Bữa ", "")}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-[2.5rem] bg-slate-50 border border-slate-100 p-8">
                <div className="flex items-center gap-6 mb-8">
                  <div className="flex size-14 items-center justify-center rounded-[1.25rem] bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                    <ImageIcon className="size-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Ảnh đại diện Tour</h3>
                    <p className="text-sm text-slate-500 font-medium">Dán link ảnh (Unsplash, Cloudinary, v.v.) vào ô bên dưới.</p>
                  </div>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-700 uppercase tracking-widest">Link ảnh Cover</label>
                      <div className="flex gap-4">
                        <Input 
                          value={formData.cover_image || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, cover_image: e.target.value }))}
                          placeholder="https://images.unsplash.com/..."
                          className="h-12 flex-1 rounded-2xl border-slate-200 px-5"
                        />
                      </div>
                    </div>

                  {formData.cover_image && (
                    <div className="relative aspect-video rounded-[2rem] overflow-hidden border-4 border-white shadow-xl">
                      <img 
                        src={formData.cover_image} 
                        className="w-full h-full object-cover" 
                        alt="Preview" 
                        onError={(e) => {
                           (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1544376798-89aa6b82c6cd?q=80&w=1974&auto=format&fit=crop";
                        }}
                      />
                      <div className="absolute top-4 left-4 rounded-full bg-slate-900/40 backdrop-blur-md px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white border border-white/20">Preview</div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6 rounded-[2rem] bg-orange-50 border border-orange-100 flex items-center gap-4 text-orange-600">
                <AlertTriangle className="size-6 shrink-0" />
                <p className="text-sm font-bold">Chức năng upload file trực tiếp đang được nâng cấp. Hiện tại vui lòng sử dụng link ảnh từ bên ngoài.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-100 px-8 py-6 bg-slate-50/30">
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose} className="rounded-2xl px-8 h-12 font-bold text-slate-500">Hủy</Button>
            <Button 
               onClick={handleSave} 
               disabled={isSaving}
               className="rounded-2xl px-12 h-12 bg-slate-900 hover:bg-slate-800 text-white shadow-xl font-bold flex items-center gap-2"
            >
              {isSaving ? "Đang xử lý..." : (
                <>
                  <Save className="size-4" />
                  {tour.id ? "Lưu thay đổi" : "Tạo Tour ngay"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}


