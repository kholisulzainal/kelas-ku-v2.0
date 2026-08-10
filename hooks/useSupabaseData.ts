import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';

export interface UseSupabaseDataOptions<T> {
  /**
   * If true, fetch data automatically on component mount and when options change.
   * Defaults to true.
   */
  autoFetch?: boolean;
  /**
   * Supabase select query string. Defaults to '*'.
   */
  selectQuery?: string;
  /**
   * Custom query filter callback to apply complex conditions, sorting, limits, etc.
   * Example: (q) => q.eq('status', 'active').order('created_at', { ascending: false })
   */
  filter?: (query: any) => any;
  /**
   * Primary key column used for update and delete queries. Defaults to 'id'.
   */
  idColumnName?: string;
  /**
   * Callback executed when data is successfully fetched.
   */
  onSuccess?: (data: T[]) => void;
  /**
   * Callback executed when an error occurs.
   */
  onError?: (error: any) => void;
}

export function useSupabaseData<T = any>(
  tableName: string,
  options: UseSupabaseDataOptions<T> = {}
) {
  const {
    autoFetch = true,
    selectQuery = '*',
    filter,
    idColumnName = 'id',
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<any>(null);

  // References to keep callbacks current without re-triggering useEffect
  const filterRef = useRef(filter);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    filterRef.current = filter;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [filter, onSuccess, onError]);

  /**
   * Fetches data from the specified table applying queries and custom filters.
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from(tableName).select(selectQuery);

      if (filterRef.current) {
        query = filterRef.current(query);
      }

      const { data: result, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const fetchedData = (result || []) as T[];
      setData(fetchedData);
      
      if (onSuccessRef.current) {
        onSuccessRef.current(fetchedData);
      }
      return fetchedData;
    } catch (err: any) {
      setError(err);
      if (onErrorRef.current) {
        onErrorRef.current(err);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [tableName, selectQuery]);

  /**
   * Inserts a single record or multiple records into the table.
   */
  const insertRecord = async (newRecord: Partial<T> | T | Array<Partial<T> | T>) => {
    setError(null);
    try {
      const { data: result, error: insertError } = await supabase
        .from(tableName)
        .insert(newRecord as any)
        .select();

      if (insertError) {
        throw insertError;
      }

      if (result) {
        const inserted = result as T[];
        setData((prev) => [...prev, ...inserted]);
        return Array.isArray(newRecord) ? inserted : inserted[0];
      }
      return null;
    } catch (err: any) {
      setError(err);
      if (onErrorRef.current) {
        onErrorRef.current(err);
      }
      return null;
    }
  };

  /**
   * Updates a record based on the specified primary key ID.
   */
  const updateRecord = async (id: string | number, updatedFields: Partial<T>) => {
    setError(null);
    try {
      const { data: result, error: updateError } = await supabase
        .from(tableName)
        .update(updatedFields as any)
        .eq(idColumnName, id)
        .select();

      if (updateError) {
        throw updateError;
      }

      if (result && result.length > 0) {
        const updated = result[0] as T;
        setData((prev) =>
          prev.map((item: any) =>
            item[idColumnName] === id ? updated : item
          )
        );
        return updated;
      }
      return null;
    } catch (err: any) {
      setError(err);
      if (onErrorRef.current) {
        onErrorRef.current(err);
      }
      return null;
    }
  };

  /**
   * Deletes a record from the table matching the specified primary key ID.
   */
  const deleteRecord = async (id: string | number) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq(idColumnName, id);

      if (deleteError) {
        throw deleteError;
      }

      setData((prev) => prev.filter((item: any) => item[idColumnName] !== id));
      return true;
    } catch (err: any) {
      setError(err);
      if (onErrorRef.current) {
        onErrorRef.current(err);
      }
      return false;
    }
  };

  // Perform auto-fetch on mount/update
  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [fetchData, autoFetch]);

  return {
    data,
    loading,
    error,
    fetchData,
    insertRecord,
    updateRecord,
    deleteRecord,
    setData,
  };
}
