const Product = require('../models/Product');
const User = require('../models/Authentication');
const MerchentStore = require('../models/MerchentStore');
const { Op, Sequelize } = require('sequelize');
const sequelize = require('../config/db');

const BN_DIGIT_MAP = {
  "\u09E6": "0",
  "\u09E7": "1",
  "\u09E8": "2",
  "\u09E9": "3",
  "\u09EA": "4",
  "\u09EB": "5",
  "\u09EC": "6",
  "\u09ED": "7",
  "\u09EE": "8",
  "\u09EF": "9",
};

const SEARCH_SYNONYM_GROUPS = [
  ["mobile", "mobail", "phone", "smartphone", "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2", "\u09AB\u09CB\u09A8"],
  ["laptop", "notebook", "\u09B2\u09CD\u09AF\u09BE\u09AA\u099F\u09AA"],
  ["computer", "pc", "desktop", "\u0995\u09AE\u09CD\u09AA\u09BF\u0989\u099F\u09BE\u09B0", "\u09A1\u09C7\u09B8\u09CD\u0995\u099F\u09AA"],
  ["fridge", "refrigerator", "\u09AB\u09CD\u09B0\u09BF\u099C"],
  ["tv", "television", "\u099F\u09BF\u09AD\u09BF"],
  ["watch", "smartwatch", "\u0998\u09DC\u09BF", "\u0998\u09A1\u09BC\u09BF"],
];

const normalizeSearchText = (value = "") => {
  const asString = String(value || "");
  const normalizedDigits = asString.replace(/[\u09E6-\u09EF]/g, (d) => BN_DIGIT_MAP[d] || d);
  return normalizedDigits
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>{}\[\]\\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const expandSearchTerms = (query = "") => {
  const normalized = normalizeSearchText(query);
  const baseTerms = normalized.split(" ").filter(Boolean);
  const terms = new Set(baseTerms);

  for (const token of baseTerms) {
    for (const group of SEARCH_SYNONYM_GROUPS) {
      if (group.includes(token)) {
        for (const w of group) terms.add(normalizeSearchText(w));
      }
    }
  }

  return Array.from(terms).slice(0, 10);
};

const buildTermOrConditions = (term) => {
  const likeTerm = `%${term}%`;
  return [
    { name: { [Op.like]: likeTerm } },
    { category: { [Op.like]: likeTerm } },
    { subCategory: { [Op.like]: likeTerm } },
    { description: { [Op.like]: likeTerm } },
  ];
};


// for user
exports.getPublicProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 24,
      search = "",
      category = "",
      subCategory = "",
      sort = "smart",
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    // only available stock
    where.stock = { [Op.gt]: 0 };

    // category exact match
    if (category && category.trim()) {
      where.category = category.trim();
    }
    if (subCategory && subCategory.trim()) {
      where.subCategory = subCategory.trim();
    }

    // search by name/category
    if (search && search.trim()) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search.trim()}%` } },
        { category: { [Op.like]: `%${search.trim()}%` } },
      ];
    }

    // Real e-commerce style ranking:
    // score = rating + review confidence + sold count + discount + freshness.
    const smartScore = Sequelize.literal(`
      (
        (COALESCE(averageRating, 0) * 28)
        + (LEAST(COALESCE(totalReviews, 0), 200) * 0.35)
        + (LEAST(COALESCE(soldCount, 0), 1000) * 0.08)
        + (
            CASE
              WHEN COALESCE(oldPrice, 0) > COALESCE(price, 0) AND COALESCE(price, 0) > 0
              THEN ((oldPrice - price) / oldPrice) * 100 * 0.9
              ELSE 0
            END
          )
        + (GREATEST(0, 30 - TIMESTAMPDIFF(DAY, createdAt, NOW())) * 0.12)
      )
    `);

    const orderBySort = {
      smart: [
        [smartScore, "DESC"],
        // deterministic mix for discovery, pagination-safe (no true random jump)
        [Sequelize.literal("MOD(id * 17, 97)"), "ASC"],
        ["createdAt", "DESC"],
        ["id", "ASC"],
      ],
      newest: [["createdAt", "DESC"], ["id", "ASC"]],
      oldest: [["createdAt", "ASC"], ["id", "ASC"]],
      price_low: [["price", "ASC"], ["id", "ASC"]],
      price_high: [["price", "DESC"], ["id", "ASC"]],
      rating: [["averageRating", "DESC"], ["totalReviews", "DESC"], ["id", "ASC"]],
      discount: [
        [
          Sequelize.literal(`
            CASE
              WHEN COALESCE(oldPrice, 0) > COALESCE(price, 0) AND COALESCE(price, 0) > 0
              THEN ((oldPrice - price) / oldPrice) * 100
              ELSE 0
            END
          `),
          "DESC",
        ],
        ["createdAt", "DESC"],
        ["id", "ASC"],
      ],
      popular: [["soldCount", "DESC"], ["averageRating", "DESC"], ["createdAt", "DESC"], ["id", "ASC"]],
    };

    const selectedSort = String(sort || "smart").toLowerCase();
    const order = orderBySort[selectedSort] || orderBySort.smart;

    const { rows, count } = await MerchentStore.findAndCountAll({
      where,
      order,
      limit: limitNum,
      offset,
    });

    return res.json({
      data: rows,
      meta: {
        sort: selectedSort,
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
        hasNext: pageNum * limitNum < count,
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    console.error("getPublicProducts error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getPublicProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await MerchentStore.findOne({
      where: {
        id,
        stock: { [Op.gt]: 0 }, // user side এ শুধু available product
      },
      include: [
        {
          model: User,
          as: "merchant", // association name
          attributes: ["id", "name", "imageUrl"],
        },
      ],
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // frontend friendly shape
    return res.json({
      success: true,
      product: {
        ...product.toJSON(),
        merchant: product.merchant
          ? {
              id: product.merchant.id,
              name: product.merchant.name,
              logo: product.merchant.imageUrl, // frontend এ logo হিসেবে যাবে
            }
          : null,
      },
    });
  } catch (err) {
    console.error("getPublicProductById error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

//search


exports.search = async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    const normalizedQuery = normalizeSearchText(query);
    const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 100);
    const offset = (pageNum - 1) * limitNum;
    const sort = String(req.query.sort || "smart").toLowerCase();

    const baseTerms = normalizedQuery.split(" ").filter(Boolean).slice(0, 8);
    const expandedTerms = expandSearchTerms(query);
    const secondaryTerms = expandedTerms.filter((t) => !baseTerms.includes(t));

    if (!normalizedQuery) {
      return res.status(200).json({
        success: true,
        query: null,
        data: [],
        products: [],
        meta: {
          sort,
          page: pageNum,
          limit: limitNum,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
          strategy: "empty_query",
          terms: [],
        },
      });
    }

    const baseWhere = {
      stock: { [Op.gt]: 0 },
    };

    // strict strategy: every base term must match at least one searchable field
    const strictWhere = {
      ...baseWhere,
      [Op.and]: baseTerms.map((term) => ({ [Op.or]: buildTermOrConditions(term) })),
    };

    // relaxed strategy fallback: any expanded term may match
    const relaxedWhere = {
      ...baseWhere,
      [Op.or]: expandedTerms.flatMap((term) => buildTermOrConditions(term)),
    };

    const scoreParts = [];

    // Full query phrase boosts (very important for relevance)
    const phraseExact = sequelize.escape(normalizedQuery);
    const phraseStarts = sequelize.escape(`${normalizedQuery}%`);
    const phraseContains = sequelize.escape(`%${normalizedQuery}%`);
    scoreParts.push(`(CASE WHEN LOWER(name) = ${phraseExact} THEN 320 ELSE 0 END)`);
    scoreParts.push(`(CASE WHEN LOWER(name) LIKE ${phraseStarts} THEN 210 ELSE 0 END)`);
    scoreParts.push(`(CASE WHEN LOWER(name) LIKE ${phraseContains} THEN 120 ELSE 0 END)`);
    scoreParts.push(`(CASE WHEN LOWER(category) LIKE ${phraseContains} THEN 40 ELSE 0 END)`);
    scoreParts.push(`(CASE WHEN LOWER(subCategory) LIKE ${phraseContains} THEN 35 ELSE 0 END)`);

    for (const term of baseTerms) {
      const exact = sequelize.escape(term);
      const starts = sequelize.escape(`${term}%`);
      const contains = sequelize.escape(`%${term}%`);

      scoreParts.push(`(CASE WHEN LOWER(name) = ${exact} THEN 180 ELSE 0 END)`);
      scoreParts.push(`(CASE WHEN LOWER(name) LIKE ${starts} THEN 100 ELSE 0 END)`);
      scoreParts.push(`(CASE WHEN LOWER(name) LIKE ${contains} THEN 55 ELSE 0 END)`);
      scoreParts.push(`(CASE WHEN LOWER(category) LIKE ${contains} THEN 22 ELSE 0 END)`);
      scoreParts.push(`(CASE WHEN LOWER(subCategory) LIKE ${contains} THEN 18 ELSE 0 END)`);
      scoreParts.push(`(CASE WHEN LOWER(description) LIKE ${contains} THEN 10 ELSE 0 END)`);
    }

    // Expanded/synonym terms are weaker signals than base typed terms
    for (const term of secondaryTerms) {
      const contains = sequelize.escape(`%${term}%`);
      scoreParts.push(`(CASE WHEN LOWER(name) LIKE ${contains} THEN 18 ELSE 0 END)`);
      scoreParts.push(`(CASE WHEN LOWER(category) LIKE ${contains} THEN 10 ELSE 0 END)`);
      scoreParts.push(`(CASE WHEN LOWER(subCategory) LIKE ${contains} THEN 8 ELSE 0 END)`);
    }

    // quality/business signals
    scoreParts.push("(COALESCE(averageRating, 0) * 16)");
    scoreParts.push("(LEAST(COALESCE(totalReviews, 0), 200) * 0.18)");
    scoreParts.push("(LEAST(COALESCE(soldCount, 0), 2000) * 0.04)");
    scoreParts.push(`(
      CASE
        WHEN COALESCE(oldPrice, 0) > COALESCE(price, 0) AND COALESCE(price, 0) > 0
        THEN ((oldPrice - price) / oldPrice) * 100 * 0.6
        ELSE 0
      END
    )`);
    scoreParts.push("(GREATEST(0, 30 - TIMESTAMPDIFF(DAY, createdAt, NOW())) * 0.1)");

    const searchScore = Sequelize.literal(`(${scoreParts.join(" + ")})`);
    const orderBySort = {
      smart: [[searchScore, "DESC"], ["soldCount", "DESC"], ["id", "ASC"]],
      newest: [["createdAt", "DESC"], ["id", "ASC"]],
      price_low: [["price", "ASC"], ["id", "ASC"]],
      price_high: [["price", "DESC"], ["id", "ASC"]],
      rating: [["averageRating", "DESC"], ["totalReviews", "DESC"], ["id", "ASC"]],
    };
    const order = orderBySort[sort] || orderBySort.smart;

    const runSearch = async (where) =>
      MerchentStore.findAndCountAll({
      where,
      order,
      limit: limitNum,
      offset,
      distinct: true,
    });

    let strategy = "strict";
    let { rows, count } = await runSearch(strictWhere);

    if (count === 0 && expandedTerms.length > 0) {
      strategy = "relaxed";
      const fallback = await runSearch(relaxedWhere);
      rows = fallback.rows;
      count = fallback.count;
    }

    // safety: avoid duplicates even if database joins/edge-cases produce any
    const uniqueRows = [];
    const seen = new Set();
    for (const row of rows) {
      const id = Number(row.id);
      if (seen.has(id)) continue;
      seen.add(id);
      uniqueRows.push(row);
    }

    return res.status(200).json({
      success: true,
      query: query || null,
      data: uniqueRows,
      products: uniqueRows,
      meta: {
        sort,
        page: pageNum,
        limit: limitNum,
        total: count,
        totalPages: Math.ceil(count / limitNum),
        hasNext: pageNum * limitNum < count,
        hasPrev: pageNum > 1,
        strategy,
        terms: expandedTerms,
      },
    });
  } catch (error) {
    console.error('SEARCH PRODUCTS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while searching products',
      error: error.message,
    });
  }
};


// for admin


// upload a product this is for admin
exports.createProduct = async (req, res) => {
    try {
        const body = req.body || {};
        
        console.log("Received product data:", body);
        const productData = {
            name: body.name,
            description: body.description,
            price:  body.price ? parseFloat(body.price) : null,
            oldPrice: body.oldPrice ? parseFloat(body.oldPrice) : null,
            stock: parseInt(body.stock),
            category: body.category,
            subCategory: body.subCategory,
            images: Array.isArray(body.imageUrl) ? body.imageUrl : [],
        };


        if (!productData.name || (!productData.price)) {
            return res.status(400).json({ message: "Name and valid Price are required fields." });
        }
        if (productData.price < 0) {
            return res.status(400).json({ message: "Price cannot be negative." });
        }

        const savedProduct = await Product.create(productData);

        res.status(201).json({
            message: "Product created successfully!",
            product: savedProduct
        });

    } catch (error) {
        console.error(error); 
        res.status(400).json({ 
            message: "Error creating product", 
            error: error.message 
        });
    }
};




