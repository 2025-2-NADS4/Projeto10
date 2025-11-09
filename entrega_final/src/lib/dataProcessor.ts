export interface OrderData {
  id: string;
  saleschannel: string;
  status: string;
  totalamount: number;
  createdat: string;
}

export interface DashboardMetrics {
  totalOrders: number;
  cancellationRate: number;
  totalRevenue: number;
  averageTicket: number;
  ordersByChannel: { channel: string; count: number }[];
  cancellationsByChannel: { channel: string; total: number; canceled: number }[];
  ordersByStatus: { status: string; count: number }[];
}

const CHANNEL_NAMES: Record<string, string> = {
  'IFOOD': 'iFood',
  'ANOTAAI': 'Anotaai',
  'WHATSAPP': 'WhatsApp',
  'SITE': 'Site',
  '99FOOD': '99Food',
  'DELIVERYVIP': 'deliveryVIP',
  'EPADOCA': 'Epadoca'
};

export async function parseOrderCSV(csvText: string): Promise<OrderData[]> {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(';').map(h => h.trim().replace('﻿', ''));
  
  const orders: OrderData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';');
    if (values.length < headers.length) continue;
    
    const order: any = {};
    headers.forEach((header, index) => {
      order[header] = values[index]?.trim() || '';
    });
    
    orders.push({
      id: order.id,
      saleschannel: order.saleschannel,
      status: order.status,
      totalamount: parseFloat(order.totalamount) || 0,
      createdat: order.createdat
    });
  }
  
  return orders;
}

export function calculateMetrics(orders: OrderData[]): DashboardMetrics {
  const totalOrders = orders.length;
  
  // Calculo taxa de cancelamento
  const canceledOrders = orders.filter(o => o.status === 'CANCELED').length;
  const cancellationRate = totalOrders > 0 ? (canceledOrders / totalOrders) * 100 : 0;
  
  // Receita 
  const nonCanceledOrders = orders.filter(o => o.status !== 'CANCELED');
  const totalRevenue = nonCanceledOrders.reduce((sum, order) => sum + order.totalamount, 0);
  
  // Ticket médio
  const averageTicket = nonCanceledOrders.length > 0 ? totalRevenue / nonCanceledOrders.length : 0;
  
  // Pedidos por canal
  const channelCounts: Record<string, number> = {};
  orders.forEach(order => {
    const channel = order.saleschannel;
    channelCounts[channel] = (channelCounts[channel] || 0) + 1;
  });
  
  const ordersByChannel = Object.entries(channelCounts).map(([channel, count]) => ({
    channel: CHANNEL_NAMES[channel] || channel,
    count
  }));
  
  // Cancelamento por canal
  const channelStats: Record<string, { total: number; canceled: number }> = {};
  orders.forEach(order => {
    const channel = order.saleschannel;
    if (!channelStats[channel]) {
      channelStats[channel] = { total: 0, canceled: 0 };
    }
    channelStats[channel].total++;
    if (order.status === 'CANCELED') {
      channelStats[channel].canceled++;
    }
  });
  
  const cancellationsByChannel = Object.entries(channelStats).map(([channel, stats]) => ({
    channel: CHANNEL_NAMES[channel] || channel,
    total: stats.total,
    canceled: stats.canceled
  }));
  
  // Pedidos por status
  const statusCounts: Record<string, number> = {
    'CANCELED': 0,
    'CONCLUDED': 0,
    'IN_PROGRESS': 0
  };
  
  orders.forEach(order => {
    if (order.status === 'CANCELED') {
      statusCounts['CANCELED']++;
    } else if (order.status === 'CONCLUDED') {
      statusCounts['CONCLUDED']++;
    } else if (['CONFIRMED', 'PENDING', 'PLACED', 'DISPATCHED'].includes(order.status)) {
      statusCounts['IN_PROGRESS']++;
    }
  });
  
  const ordersByStatus = [
    { status: 'Cancelados', count: statusCounts['CANCELED'] },
    { status: 'Concluídos', count: statusCounts['CONCLUDED'] },
    { status: 'Em Andamento', count: statusCounts['IN_PROGRESS'] }
  ];
  
  return {
    totalOrders,
    cancellationRate,
    totalRevenue,
    averageTicket,
    ordersByChannel,
    cancellationsByChannel,
    ordersByStatus
  };
}

export async function loadOrderData(): Promise<DashboardMetrics> {
  try {
    const response = await fetch('/data/orders.csv');
    const csvText = await response.text();
    const orders = await parseOrderCSV(csvText);
    return calculateMetrics(orders);
  } catch (error) {
    console.error('Error loading order data:', error);
    throw error;
  }
}
