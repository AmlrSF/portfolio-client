import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Heart, Eye, Filter, Loader2, Clock } from 'lucide-react';
import { TextGenerateEffect } from './ui/TextGenerateEffect';

interface Project {
  _id: string;
  title: string;
  category: 'branding' | 'poster' | 'social' | 'illustration';
  description: string;
  image: string;
  thumbnail?: string;
  likes: number;
  views: number;
  featured: boolean;
  status: 'published' | 'draft' | 'archived';
  tags: string[];
  clientName?: string;
  projectUrl?: string;
  completedAt: string;
}

interface ApiResponse {
  projects: Project[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const DynamicPortfolio = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedImage, setSelectedImage] = useState<Project | null>(null);
  const [filter, setFilter] = useState('all');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [likedProjects, setLikedProjects] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());

  const categories = [
    { key: 'all', label: 'All Works' },
    { key: 'branding', label: 'Branding' },
    { key: 'poster', label: 'Posters' },
    { key: 'social', label: 'Social Media' },
    { key: 'illustration', label: 'Illustrations' }
  ];

  // Function to process tags - handles both array of strings and single string with # separators
  const processTags = (tags: string[], maxTags: number = 8) => {
    // If tags is a single string with multiple hashtags, split it
    const allTags = tags.flatMap(tag => {
      // Split by # and filter out empty strings
      return tag.split('#').filter(t => t.trim().length > 0);
    });

    return allTags
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .filter((tag, index, self) => self.indexOf(tag) === index) // Remove duplicates
      .slice(0, maxTags);
  };

  // Tag color variations for individual backgrounds
  const getTagColor = (index: number) => {
    const colors = [
      'from-purple-500/20 to-pink-500/20 border-purple-500/30',
      'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
      'from-green-500/20 to-emerald-500/20 border-green-500/30',
      'from-orange-500/20 to-red-500/20 border-orange-500/30',
      'from-yellow-500/20 to-amber-500/20 border-yellow-500/30',
      'from-indigo-500/20 to-purple-500/20 border-indigo-500/30',
      'from-pink-500/20 to-rose-500/20 border-pink-500/30',
      'from-teal-500/20 to-green-500/20 border-teal-500/30'
    ];
    return colors[index % colors.length];
  };

  const fetchProjects = useCallback(async (page: number, filter: string, isLoadMore = false) => {
    const requestKey = `${page}-${filter}`;
    if (pendingRequests.has(requestKey)) return;

    setPendingRequests(prev => new Set(prev).add(requestKey));

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        status: 'published',
        page: page.toString(),
        limit: '12',
        sortBy: 'featured,createdAt',
        sortOrder: 'desc'
      });

      if (filter !== 'all') {
        params.set('category', filter);
      }

      const response = await fetch(`/api/projects?${params}`);
      if (!response.ok) throw new Error('Failed to fetch projects');

      const data: ApiResponse = await response.json();

      if (page === 1) {
        setProjects(data.projects);
      } else {
        setProjects(prev => {
          const existingIds = new Set(prev.map(p => p._id));
          const newProjects = data.projects.filter(p => !existingIds.has(p._id));
          return [...prev, ...newProjects];
        });
      }

      setTotalPages(data.pagination.pages);
      setHasMore(page < data.pagination.pages);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
      setPendingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestKey);
        return newSet;
      });
    }
  }, [pendingRequests]);

  useEffect(() => {
    fetchProjects(1, filter);
  }, [filter]);

  const handleProjectClick = async (project: Project) => {
    const requestKey = `view-${project._id}`;
    if (pendingRequests.has(requestKey)) return;

    setPendingRequests(prev => new Set(prev).add(requestKey));

    try {
      await fetch(`/api/projects/${project._id}/view`, { method: 'POST' });

      setProjects(prev =>
        prev.map(p =>
          p._id === project._id && p.views === project.views
            ? { ...p, views: p.views + 1 }
            : p
        )
      );
    } catch (error) {
      console.error('Failed to track view:', error);
    } finally {
      setPendingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestKey);
        return newSet;
      });
    }

    setSelectedImage(project);
  };

  const handleLike = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();

    const requestKey = `like-${project._id}`;
    if (pendingRequests.has(requestKey)) return;

    const isLiked = likedProjects.has(project._id);
    const newLikedState = new Set(likedProjects);

    if (isLiked) {
      newLikedState.delete(project._id);
    } else {
      newLikedState.add(project._id);
    }

    setLikedProjects(newLikedState);
    setPendingRequests(prev => new Set(prev).add(requestKey));

    try {
      const response = await fetch(`/api/projects/${project._id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liked: !isLiked })
      });

      if (!response.ok) throw new Error('Like request failed');

      const result = await response.json();

      setProjects(prev =>
        prev.map(p =>
          p._id === project._id
            ? { ...p, likes: result.likes }
            : p
        )
      );
    } catch (error) {
      console.error('Failed to update like:', error);
      setLikedProjects(prev => {
        const newSet = new Set(prev);
        if (isLiked) {
          newSet.add(project._id);
        } else {
          newSet.delete(project._id);
        }
        return newSet;
      });
    } finally {
      setPendingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestKey);
        return newSet;
      });
    }
  };

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setCurrentPage(1);
    setProjects([]);
    setHasMore(true);
  };

  const loadMoreProjects = () => {
    if (currentPage < totalPages && !isLoadingMore) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchProjects(nextPage, filter, true);
    }
  };

  const getCategoryGradient = (category: string) => {
    const gradients = {
      branding: 'from-purple-600 to-blue-600',
      poster: 'from-pink-600 to-red-600',
      social: 'from-blue-600 to-cyan-600',
      illustration: 'from-green-600 to-emerald-600'
    };
    return gradients[category as keyof typeof gradients] || 'from-gray-600 to-slate-600';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const SkeletonCard = ({ index }: { index: number }) => {
    const delay = index * 0.1;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay }}
        className="relative rounded-2xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 overflow-hidden backdrop-blur-sm"
      >
        <div className="aspect-square relative animate-pulse bg-gradient-to-br from-gray-800 to-gray-700">
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="h-6 bg-white/10 rounded-lg w-3/4 animate-pulse"></div>
          <div className="h-4 bg-white/10 rounded-lg w-full animate-pulse"></div>
          <div className="h-4 bg-white/10 rounded-lg w-2/3 animate-pulse"></div>
          <div className="flex gap-2 pt-2">
            <div className="h-5 bg-white/10 rounded-full w-16 animate-pulse"></div>
            <div className="h-5 bg-white/10 rounded-full w-16 animate-pulse"></div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="py-20 px-4" id="projects">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold text-white mb-4">
            My Creative
            <TextGenerateEffect
              words="Portfolio"
              className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text"
            />
          </h1>

          <p className="text-white/70 mb-8 max-w-2xl mx-auto text-lg">
            Explore my collection of creative projects including brand identities,
            posters, social media graphics, and digital illustrations.
          </p>

          {/* Filter Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {categories.map((category) => (
              <motion.button
                key={category.key}
                onClick={() => handleFilterChange(category.key)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-6 py-3 rounded-full border backdrop-blur-sm transition-all duration-300 ${filter === category.key
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent shadow-lg shadow-purple-500/25'
                  : 'bg-white/10 text-white/70 border-white/20 hover:border-purple-400 hover:text-white hover:bg-white/20'
                  }`}
              >
                <Filter className="w-4 h-4 inline mr-2" />
                {category.label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Loading State - Skeleton */}
        {loading && projects.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {[...Array(8)].map((_, index) => (
              <SkeletonCard key={index} index={index} />
            ))}
          </div>
        )}

        {/* Portfolio Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
          layout
        >
          <AnimatePresence>
            {projects.map((project, index) => {
              const processedTags = processTags(project.tags || [], 3);
              const hasMoreTags = project.tags && project.tags.length > 3;

              return (
                <motion.div
                  key={project._id}
                  layout
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -20 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="relative group cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => handleProjectClick(project)}
                >
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 hover:border-purple-500/50 transition-all duration-500 backdrop-blur-sm hover:shadow-xl hover:shadow-purple-500/10 h-full flex flex-col">
                    {/* Project Image */}
                    <div className="aspect-square relative overflow-hidden flex-shrink-0">
                      {project.image ? (
                        <img
                          src={project.image}
                          alt={project.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}

                      {/* Fallback gradient */}
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${getCategoryGradient(project.category)} flex items-center justify-center ${project.image ? 'hidden' : ''}`}
                      >
                        <div className="text-center p-6">
                          <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
                            <span className="text-2xl">🎨</span>
                          </div>
                          <h3 className="font-bold text-lg mb-2 text-white">{project.title}</h3>
                          <p className="text-sm opacity-80 text-white/80">{project.description}</p>
                        </div>
                      </div>

                      {/* Hover Overlay */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        initial={false}
                        animate={{ opacity: hoveredIndex === index ? 1 : 0 }}
                      >
                        <div className="text-center p-6 w-full">
                          <div className="flex items-center justify-center space-x-6 mb-4">
                            <motion.button
                              onClick={(e) => handleLike(project, e)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className={`flex items-center transition-colors ${likedProjects.has(project._id) ? 'text-red-400' : 'text-white/80 hover:text-red-400'
                                }`}
                              disabled={pendingRequests.has(`like-${project._id}`)}
                            >
                              <Heart
                                className={`w-5 h-5 mr-1 ${likedProjects.has(project._id) ? 'fill-current' : ''
                                  } ${pendingRequests.has(`like-${project._id}`) ? 'animate-pulse' : ''}`}
                              />
                              <span className="font-medium">{project.likes}</span>
                            </motion.button>

                            <div className="flex items-center text-white/80">
                              <Eye className="w-5 h-5 mr-1" />
                              <span className="font-medium">{project.views}</span>
                            </div>
                          </div>

                          <motion.div
                            initial={{ scale: 0, y: 20 }}
                            animate={{ scale: hoveredIndex === index ? 1 : 0, y: hoveredIndex === index ? 0 : 20 }}
                            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white font-medium shadow-lg"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Project
                          </motion.div>
                        </div>
                      </motion.div>

                      {/* Featured Badge */}
                      {project.featured && (
                        <div className="absolute top-4 left-4">
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-black text-xs font-bold rounded-full shadow-lg"
                          >
                            ⭐ Featured
                          </motion.span>
                        </div>
                      )}

                      {/* Category Badge */}
                      <div className="absolute top-4 right-4">
                        <span className="px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs text-white/90 border border-white/20 font-medium">
                          {project.category.charAt(0).toUpperCase() + project.category.slice(1)}
                        </span>
                      </div>
                    </div>

                    {/* Project Info */}
                    <div className="p-4 flex flex-col flex-grow">
                      <h3 className="font-bold text-lg text-white mb-1 truncate">
                        {project.title}
                      </h3>
                      <p className="text-white/60 text-sm line-clamp-2 mb-2 flex-grow">
                        {project.description}
                      </p>

                      <div className="flex justify-between items-center mb-3">
                        {project.clientName && (
                          <p className="text-purple-400 text-xs font-medium">
                            Client: {project.clientName}
                          </p>
                        )}

                        {project.completedAt && (
                          <p className="text-white/40 text-xs flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatDate(project.completedAt)}
                          </p>
                        )}
                      </div>

                      {/* Tags with individual backgrounds */}
                      {processedTags.length > 0 && (
                        <div className="mt-auto pt-3 border-t border-white/10">
                          <div className="flex flex-wrap gap-2 mb-2">
                            {processedTags.map((tag, tagIndex) => (
                              <span
                                key={tagIndex}
                                className={`px-2 py-1 bg-gradient-to-r ${getTagColor(tagIndex)} text-white/90 rounded-full text-xs backdrop-blur-sm border`}
                              >
                                #{tag}
                              </span>
                            ))}
                            {hasMoreTags && (
                              <span className="px-2 py-1 bg-white/5 text-white/50 text-xs rounded-full">
                                +{project.tags!.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Stats bar at bottom */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                        <div className="flex items-center text-white/50 text-xs">
                          <Heart className={`w-4 h-4 mr-1 ${likedProjects.has(project._id) ? 'text-red-400 fill-current' : ''
                            }`} />
                          <span>{project.likes}</span>
                        </div>
                        <div className="flex items-center text-white/50 text-xs">
                          <Eye className="w-4 h-4 mr-1" />
                          <span>{project.views}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* Load More Button */}
        {hasMore && !loading && (
          <div className="text-center mt-12">
            <motion.button
              onClick={loadMoreProjects}
              disabled={isLoadingMore}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-full text-white font-medium transition-all duration-300 shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin inline" />
                  Loading More Projects...
                </>
              ) : (
                `Load More Projects (${projects.length} of ${totalPages * 12})`
              )}
            </motion.button>
          </div>
        )}

        {/* No Projects Message */}
        {!loading && projects.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎨</div>
            <h3 className="text-2xl font-bold text-white mb-2">No projects found</h3>
            <p className="text-white/60">Try selecting a different category or check back later.</p>
          </div>
        )}
      </div>

      {/* Modal for full-screen view */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-6xl w-full max-h-[90vh] bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl overflow-hidden border border-white/20 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm border border-white/20"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              <div className="flex flex-col md:flex-row h-full overflow-hidden">
                {/* Image Section */}
                <div className="md:w-1/2 h-64 md:h-auto bg-gradient-to-br from-purple-900/30 to-pink-900/30 flex items-center justify-center overflow-hidden">
                  {selectedImage.image ? (
                    <img
                      src={selectedImage.image}
                      alt={selectedImage.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="text-center p-8">
                      <div className="w-24 h-24 mx-auto mb-6 bg-white/20 rounded-full flex items-center justify-center">
                        <span className="text-4xl">🎨</span>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">{selectedImage.title}</h3>
                      <p className="text-white/80">{selectedImage.description}</p>
                    </div>
                  )}
                </div>

                {/* Details Section - Scrollable */}
                <div className="md:w-1/2 p-6 md:p-8 overflow-y-auto flex-1">
                  <div className="mb-4">
                    <span className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full font-medium">
                      {selectedImage.category.charAt(0).toUpperCase() + selectedImage.category.slice(1)}
                    </span>
                    {selectedImage.featured && (
                      <span className="ml-2 px-3 py-1 bg-yellow-500 text-black text-sm rounded-full font-bold">
                        ⭐ Featured
                      </span>
                    )}
                  </div>

                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                    {selectedImage.title}
                  </h2>

                  <p className="text-white/80 text-lg mb-6 leading-relaxed">
                    {selectedImage.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {selectedImage.clientName && (
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-white/50 text-sm mb-1">Client</p>
                        <p className="text-purple-400 font-medium text-lg">{selectedImage.clientName}</p>
                      </div>
                    )}

                    {selectedImage.completedAt && (
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-white/50 text-sm mb-1">Completed On</p>
                        <p className="text-white font-medium text-lg">{formatDate(selectedImage.completedAt)}</p>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center space-x-8 mb-6 py-4 border-y border-white/10">
                    <div className="flex items-center text-white/80">
                      <Heart className={`w-6 h-6 mr-3 ${likedProjects.has(selectedImage._id) ? 'text-red-400 fill-current' : 'text-red-400'}`} />
                      <div className='flex items-center gap-3'>
                        <p className="text-2xl font-bold text-white">{selectedImage.likes}</p>
                        <p className="text-white/60 text-sm">likes</p>
                      </div>
                    </div>
                    <div className="flex items-center text-white/80">
                      <Eye className="w-6 h-6 mr-3 text-blue-400" />
                      <div className='flex items-center gap-3'>
                        <p className="text-2xl font-bold text-white">{selectedImage.views}</p>
                        <p className="text-white/60 text-sm">views</p>
                      </div>
                    </div>
                  </div>

                  {/* Tags with individual backgrounds */}
                  {selectedImage.tags && selectedImage.tags.length > 0 && (
                    <div className="mb-6">
                      <p className="text-white/60 text-sm mb-3">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {processTags(selectedImage.tags, 8).map((tag, index) => (
                          <motion.span
                            key={index}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className={`px-3 py-2 bg-gradient-to-r ${getTagColor(index)} text-white/90 rounded-full text-sm hover:scale-105 transition-all duration-300 border backdrop-blur-sm cursor-default`}
                          >
                            #{tag}
                          </motion.span>
                        ))}
                        {selectedImage.tags.length > 8 && (
                          <span className="px-3 py-2 bg-white/10 text-white/50 rounded-full text-sm border border-white/20">
                            +{selectedImage.tags.length - 8}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/10">
                    <motion.button
                      onClick={(e) => handleLike(selectedImage, e)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={pendingRequests.has(`like-${selectedImage._id}`)}
                      className={`flex items-center justify-center px-6 py-4 rounded-full font-medium transition-all ${likedProjects.has(selectedImage._id)
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                        } disabled:opacity-50 flex-1`}
                    >
                      <Heart className={`w-5 h-5 mr-2 ${likedProjects.has(selectedImage._id) ? 'fill-current' : ''
                        } ${pendingRequests.has(`like-${selectedImage._id}`) ? 'animate-pulse' : ''}`} />
                      {pendingRequests.has(`like-${selectedImage._id}`)
                        ? 'Updating...'
                        : likedProjects.has(selectedImage._id)
                          ? 'Liked'
                          : 'Like'
                      }
                    </motion.button>

                    {selectedImage.projectUrl && (
                      <motion.a
                        href={selectedImage.projectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center justify-center px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-medium shadow-lg shadow-purple-500/25 hover:from-purple-700 hover:to-pink-700 transition-all flex-1"
                      >
                        <ExternalLink className="w-5 h-5 mr-2" />
                        View Live
                      </motion.a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DynamicPortfolio;