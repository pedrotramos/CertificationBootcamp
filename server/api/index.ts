import express from 'express';
import cors from 'cors';
import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import { User, Question, ExamResult } from '../../types';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/certificationbootcamp';
const DB_NAME = process.env.DB_NAME || 'certificationbootcamp';

let client: MongoClient | null = null;
let db: Db;

// MongoDB connection
async function connectToMongoDB() {
    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log('Connected to MongoDB');

        // Create indexes
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('results').createIndex({ userId: 1, timestamp: -1 });
        await db.collection('whitelisted_domains').createIndex({ domain: 1 }, { unique: true });

        // Initialize questions if collection is empty
        const questionsCount = await db.collection('questions').countDocuments();
        if (questionsCount === 0) {
            const initialQuestions: Question[] = [
                {
                    category: 'Infraestrutura Cloud',
                    enunciado: 'Qual dos seguintes serviços da AWS é projetado especificamente para armazenamento de objetos altamente escalável?',
                    enunciadoImageUrl: 'https://picsum.photos/seed/cloud1/800/400',
                    options: [
                        { id: 'a', text: 'Amazon EC2' },
                        { id: 'b', text: 'Amazon S3', imageUrl: 'https://picsum.photos/seed/s3/200/200' },
                        { id: 'c', text: 'Amazon RDS' },
                        { id: 'd', text: 'AWS Lambda' }
                    ],
                    correctOptionId: 'b',
                    explanation: 'O Amazon S3 (Simple Storage Service) é um serviço de armazenamento de objetos que oferece escalabilidade, disponibilidade de dados, segurança e performance líderes do setor.',
                    exam: "Data Engineer Associate"
                },
                {
                    category: 'Segurança',
                    enunciado: 'Ao analisar a topologia de rede abaixo, qual componente representa a maior vulnerabilidade para um ataque de Man-in-the-Middle?',
                    enunciadoImageUrl: 'https://picsum.photos/seed/security1/800/400',
                    options: [
                        { id: 'a', text: 'Firewall de Borda' },
                        { id: 'b', text: 'Switch Gerenciável' },
                        { id: 'c', text: 'Ponto de Acesso Wi-Fi Público', imageUrl: 'https://picsum.photos/seed/wifi/200/200' },
                        { id: 'd', text: 'Servidor VPN' }
                    ],
                    correctOptionId: 'c',
                    explanation: 'Pontos de acesso Wi-Fi públicos e não criptografados são vetores comuns para ataques de interceptação de dados.',
                    exam: "Data Engineer Associate"
                },
                {
                    category: 'Desenvolvimento',
                    enunciado: 'Observe o snippet de código abaixo. Qual será o output impresso no console?',
                    enunciadoImageUrl: 'https://picsum.photos/seed/code1/800/200',
                    options: [
                        { id: 'a', text: 'undefined' },
                        { id: 'b', text: 'ReferenceError' },
                        { id: 'c', text: '42' },
                        { id: 'd', text: 'null' }
                    ],
                    correctOptionId: 'c',
                    explanation: 'Devido ao hoisting de funções em JavaScript, a variável é acessível após a atribuição conforme demonstrado.',
                    exam: "Data Engineer Associate"
                }
            ];
            await db.collection('questions').insertMany(initialQuestions);
            console.log('Initialized questions collection');
        }
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

// API Routes

// Get 30 random questions
app.get('/api/questions', async (req, res) => {
    try {
        const questions = await db.collection('questions')
            .aggregate([{ $sample: { size: 30 } }])
            .toArray();
        res.json(questions);
        console.log(questions.length)
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});

// Get user by email
app.get('/api/users/email/:email', async (req, res) => {
    try {
        const email = req.params.email.toLowerCase();
        const user = await db.collection('users').findOne({ email });
        res.json(user || null);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Save user
app.post('/api/users', async (req, res) => {
    try {
        const userData: User = req.body;
        await db.collection('users').insertOne(userData);
        res.json(userData);
    } catch (error: any) {
        console.error('Error saving user:', error);
        if (error.code === 11000) {
            res.status(409).json({ error: 'User with this email already exists' });
        } else {
            res.status(500).json({ error: 'Failed to save user' });
        }
    }
});

// Save exam result
app.post('/api/results', async (req, res) => {
    try {
        const resultData: ExamResult = req.body;
        console.log(resultData)
        await db.collection('results').insertOne(resultData);
        res.json(resultData);
    } catch (error) {
        console.error('Error saving result:', error);
        res.status(500).json({ error: 'Failed to save result' });
    }
});

// Get user results
app.get('/api/results/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const results = await db.collection('results')
            .find({ userId })
            .sort({ timestamp: -1 })
            .toArray();
        res.json(results);
    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
});

app.get('/api/domain/:domain', async (req, res) => {
    try {
        const domain = req.params.domain;
        const exists = await db.collection('whitelisted_domains').findOne({ domain: domain.toLowerCase() });
        res.json(Boolean(exists));
    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: db ? 'connected' : 'disconnected' });
});

// Start server
connectToMongoDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    if (client) {
        await client.close();
        console.log('MongoDB connection closed');
    }
    process.exit(0);
});

export default app;