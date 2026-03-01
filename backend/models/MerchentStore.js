const { DataTypes} = require('sequelize');
const sequelize = require('../config/db');

const parseJsonArray = (value) => {
    const normalize = (arr) =>
        arr.map((item) => (typeof item === "string" ? item.replace(/\\/g, "/") : item));

    if (Array.isArray(value)) return normalize(value);
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? normalize(parsed) : [];
        } catch {
            return [];
        }
    }
    return [];
};

const normalizeKeywords = (value) => {
    const arr = parseJsonArray(value);
    const seen = new Set();
    const out = [];
    for (const item of arr) {
        const k = String(item || "").trim().toLowerCase();
        if (!k) continue;
        if (k.length > 40) continue;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(k);
        if (out.length >= 10) break;
    }
    return out;
};


const MerchentStore = sequelize.define('MerchentStore', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    merchantId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    oldPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    category: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    subCategory: {
         type: DataTypes.STRING, 
         allowNull: true 
    },

    images: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        get() {
            return parseJsonArray(this.getDataValue("images"));
        },
        set(value) {
            this.setDataValue("images", parseJsonArray(value));
        },
    },

    keywords: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        get() {
            return normalizeKeywords(this.getDataValue("keywords"));
        },
        set(value) {
            this.setDataValue("keywords", normalizeKeywords(value));
        },
    },

    soldCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    averageRating: {
        type: DataTypes.DECIMAL(3, 2), // e.g. 4.50
        allowNull: false,
        defaultValue: 0,
    },

    totalReviews: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
}, {
    timestamps: true,
});

module.exports = MerchentStore;
