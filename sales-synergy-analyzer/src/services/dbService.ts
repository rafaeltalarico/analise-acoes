import { Pool } from 'pg';

// Configuração da conexão com o banco de dados PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  ssl: { rejectUnauthorized: false },
});

// Função para executar consultas SQL
export const query = async (text: string, params?: any[]) => {
  try {
    const result = await pool.query(text, params);
    return result.rows;
  } catch (error) {
    console.error('Erro ao executar consulta:', error);
    throw error;
  }
};

// Função para obter todos os produtos
export const getProducts = async () => {
  const text = 'SELECT id_produto, nome_produto, preco FROM produto';
  return await query(text);
};

// Função para obter todas as compras
export const getPurchases = async () => {
  const text = 'SELECT id_compra, data_compra, cpf FROM compra';
  return await query(text);
};

// Função para obter todos os itens de compra
export const getPurchaseItems = async () => {
  const text = 'SELECT id, id_compra, id_produto, valor_unitario, encarte FROM itens_compra';
  return await query(text);
};

// Função para obter compras por período
export const getPurchasesByDateRange = async (startDate: string, endDate: string) => {
  const text = 'SELECT id_compra, data_compra, cpf FROM compra WHERE data_compra >= $1 AND data_compra <= $2';
  return await query(text, [startDate, endDate]);
};

// Função para obter itens de compra por IDs de compra
export const getPurchaseItemsByPurchaseIds = async (purchaseIds: number[]) => {
  const text = 'SELECT id, id_compra, id_produto, valor_unitario, encarte FROM itens_compra WHERE id_compra = ANY($1)';
  return await query(text, [purchaseIds]);
};

// Função para obter um produto pelo ID
export const getProductById = async (productId: number) => {
  const text = 'SELECT id_produto, nome_produto, preco FROM produto WHERE id_produto = $1';
  const result = await query(text, [productId]);
  return result.length > 0 ? result[0] : null;
};

// Função para buscar produto por nome (parcial)
export const getProductByName = async (productName: string) => {
  const text = 'SELECT id_produto, nome_produto, preco FROM produto WHERE nome_produto ILIKE $1';
  const result = await query(text, [`%${productName}%`]);
  return result.length > 0 ? result[0] : null;
};